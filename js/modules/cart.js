// --- js/modules/cart.js ---
import { UI } from './ui.js';
import { DB } from '../db.js';

export const Cart = {
    addToCartLogic(product, state, updateCartCount) {
        if (!product) return;
        this.addToCart(product, (product.quantity || 1), state, updateCartCount);
    },

    addToCart(productOrId, qty = 1, state, updateCartCount) {
        let product = null;

        if (typeof productOrId === 'object') {
            product = productOrId;
        } else {
            product = state.products.find(p => String(p.id) === String(productOrId));
        }

        if (!product) return;

        // Clone
        const item = JSON.parse(JSON.stringify(product));
        item.quantity = qty;

        // Apply Price
        const effectivePrice = this.calculatePrice(item, state.currentUser);
        item.price = effectivePrice.toFixed(2).replace('.', ',') + ' €';

        const existing = state.cart.find(i => String(i.id) === String(item.id));
        if (existing) {
            existing.quantity = (existing.quantity || 1) + qty;
            existing.price = item.price; // Update in case role changed
        } else {
            state.cart.push(item);
        }

        updateCartCount();
        UI.showModal('Hinzugefügt', item.name);

        if (state.currentUser) {
            DB.saveCart(state.currentUser.username, state.cart);
        }
    },

    // --- Pricing Algorithm (Updated Step 375) ---
    // --- Pricing Algorithm (Updated for precise rules) ---
    calculatePrice(product, user) {
        let rawPrice = 0;

        // Search module now sends 'price' as NUMBER (e.g. 5.50).
        // Legacy products might still have strings "5,50 €".
        if (typeof product.price === 'number') {
            rawPrice = product.price;
        } else if (typeof product.price === 'string') {
            // Remove '€', replace ',' with '.'
            rawPrice = parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        }

        // Safety Fallback
        if (rawPrice <= 0) rawPrice = 5.00;

        // If we have an explicit 'originalPrice' property (e.g. from data-price), prefer that?
        // User said: "It's not about discounted price, but original standard price."
        // We will assume 'product.price' IS the standard price unless we have 'originalPrice'.
        // If scraper finds sale price, we might be in trouble.
        // But let's apply the math rules first.

        // Logic 1: Pablo User
        if (user && user.isPablo) {
            const name = (product.name || '').toLowerCase();
            if (name.includes('pablo')) {
                // Rule: If < 4.00 -> 4.00
                // If > 4.00 -> Round Up
                if (rawPrice < 4.00) return 4.00;
                return Math.ceil(rawPrice);
            }
        }

        // Logic 2: Standard Rule (Everyone else OR Non-Pablo products for Pablo users)
        // Rule: If < 5.00 -> 5.00
        // If > 5.00 -> Round Up
        if (rawPrice < 5.00) return 5.00;
        return Math.ceil(rawPrice);
    },

    updateCartCount(state, elements) {
        const total = state.cart.reduce((s, i) => s + (i.quantity || 1), 0);
        if (elements.cartCount) elements.cartCount.textContent = total;
    },

    changeCartQty(index, delta, state, renderCart, updateCartCount) {
        const item = state.cart[index];
        if (item) {
            item.quantity = (item.quantity || 1) + delta;

            // Re-calc price
            const p = this.calculatePrice(item, state.currentUser);
            item.price = p.toFixed(2).replace('.', ',') + ' €';

            if (item.quantity <= 0) state.cart.splice(index, 1);

            renderCart();
            updateCartCount();

            if (state.currentUser) {
                DB.saveCart(state.currentUser.username, state.cart);
            }
        }
    },

    async placeOrder(state, DB, elements, updateCartCount, navigateTo) {
        if (state.cart.length === 0) return UI.showModal('Fehler', 'Warenkorb leer');

        const finalItems = state.cart.map(item => {
            const p = this.calculatePrice(item, state.currentUser);
            return {
                ...item,
                price: p.toFixed(2).replace('.', ',') + ' €'
            };
        });

        const newId = DB.generateOrderId(state.editingOrderId);

        const totalVal = finalItems.reduce((acc, item) => {
            let p = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            return acc + (p * (item.quantity || 1));
        }, 0);

        const order = {
            id: newId,
            user: state.currentUser.username,
            items: finalItems,
            total: totalVal.toFixed(2).replace('.', ',') + ' €',
            date: new Date().toLocaleString(),
            status: 'open',
            archivedBy: [],
            note: elements.orderNote ? elements.orderNote.value : ''
        };

        try {
            await DB.saveOrder(order);

            // DELETE OLD ORDER Logic (If editing)
            if (state.editingOrderId && state.editingOrderId !== newId) {
                // If we generated a NEW ID (e.g. #1005 -> #1005B), allow deleting the old one (#1005)
                await DB.deleteOrder(state.editingOrderId);
                console.log('Old order deleted:', state.editingOrderId);
            }

            state.cart = [];
            state.editingOrderId = null;
            if (elements.orderNote) elements.orderNote.value = '';
            updateCartCount();

            if (state.currentUser) {
                DB.saveCart(state.currentUser.username, []);
            }

            navigateTo('profile');
            UI.showModal('Erfolg', 'Bestellung ' + newId);
        } catch (e) {
            UI.showModal('Fehler', e.message);
        }
    }
};

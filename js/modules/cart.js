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

        // Clone to avoid mutation of catalog
        const item = JSON.parse(JSON.stringify(product));
        item.quantity = qty;

        // Apply Pricing Logic Immediately (and will be re-checked on calc)
        const effectivePrice = this.calculatePrice(item, state.currentUser);
        item.price = effectivePrice.toFixed(2).replace('.', ',') + ' €';

        const existing = state.cart.find(i => String(i.id) === String(item.id));
        if (existing) {
            existing.quantity = (existing.quantity || 1) + qty;
            existing.price = item.price; // Update price in case user role changed
        } else {
            state.cart.push(item);
        }

        updateCartCount();
        UI.showModal('Hinzugefügt', item.name);

        // Sync to Cloud
        if (state.currentUser) {
            DB.saveCart(state.currentUser.username, state.cart);
        }
    },

    // --- Pricing Algorithm ---
    calculatePrice(product, user) {
        // Parse original raw price (assuming product.price might be string "4,50 €" or number)
        // If product comes from Catalog, it might have string "4,50 €"
        let rawPrice = 0;
        if (typeof product.price === 'number') rawPrice = product.price;
        else if (typeof product.price === 'string') {
            rawPrice = parseFloat(product.price.replace('€', '').replace(',', '.').trim()) || 0;
        }

        // Logic 1: Pablo Flatrate
        if (user && user.isPablo) {
            const name = (product.name || '').toLowerCase();
            if (name.includes('pablo')) {
                return 4.00;
            }
        }

        // Logic 2: Standard Floor / Ceiling
        if (rawPrice < 5.0) {
            return 5.00;
        } else if (rawPrice > 5.0) {
            return Math.ceil(rawPrice);
        }

        return rawPrice; // Exactly 5.00 stays 5.00
    },

    updateCartCount(state, elements) {
        const total = state.cart.reduce((s, i) => s + (i.quantity || 1), 0);
        if (elements.cartCount) elements.cartCount.textContent = total;
    },

    changeCartQty(index, delta, state, renderCart, updateCartCount) {
        const item = state.cart[index];
        if (item) {
            item.quantity = (item.quantity || 1) + delta;

            // Re-calc price if role changed? 
            // Better to do it on render or when role changes?
            // Let's ensure it's correct here too.
            const p = this.calculatePrice(item, state.currentUser);
            item.price = p.toFixed(2).replace('.', ',') + ' €';

            if (item.quantity <= 0) state.cart.splice(index, 1);

            renderCart();
            updateCartCount();

            // Sync to Cloud
            if (state.currentUser) {
                DB.saveCart(state.currentUser.username, state.cart);
            }
        }
    },

    async placeOrder(state, DB, elements, updateCartCount, navigateTo) {
        if (state.cart.length === 0) return UI.showModal('Fehler', 'Warenkorb leer');

        // Final Price Check before ordering
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
            state.cart = [];
            state.editingOrderId = null;
            if (elements.orderNote) elements.orderNote.value = '';
            updateCartCount();

            // Clear Cloud Cart
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

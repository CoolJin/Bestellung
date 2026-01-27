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
    // --- Pricing Algorithm (MPF/OPF Logic) ---
    calculatePrice(product, user) {
        let EP = 0; // Echt Preis

        if (product.originalPrice !== undefined && product.originalPrice !== null) {
            EP = parseFloat(product.originalPrice);
        } else if (typeof product.price === 'number') {
            EP = product.price;
        } else if (typeof product.price === 'string') {
            EP = parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        }

        // Safety
        if (EP <= 0) EP = 5.00;

        const isMPF = user && user.isPablo; // Mit Pablo Flatrate
        const isWP = (product.name || '').toLowerCase().includes('pablo'); // Wenn Pablo

        // Helper: "Aufgerundet auf nächste volle Zahl"
        // Context: User previously stated "Margin > 0".
        // If EP=4.00, Selling=4.00 is 0 margin.
        // Thus "Next Full Number" implies Math.floor(EP) + 1.
        // Example: 4.00 -> 5.00. 4.01 -> 5.00. 4.99 -> 5.00.
        const roundNextFull = (val) => Math.floor(val) + 1;

        if (isMPF) {
            // --- MPF Rules ---
            if (EP < 4.00) {
                // MPF EP < 4.00€
                if (isWP) return 4.00; // AP 4.00€ (WP)
                return 5.00;           // AP 5.00€ (WNP)
            } else {
                // MPF EP >= 4.00€
                // "AP aufgerundet auf nächste volle Zahl (WP & WNP)"
                return roundNextFull(EP);
            }
        } else {
            // --- OPF Rules (Standard User) ---
            if (EP < 5.00) {
                // OPF EP < 5.00€ --> AP 5.00€
                return 5.00;
            } else {
                // OPF EP >= 5.00€ --> AP aufgerundet
                return roundNextFull(EP);
            }
        }
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

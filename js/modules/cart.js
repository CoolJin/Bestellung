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
    calculatePrice(product, user) {
        let rawPrice = 0;
        if (typeof product.price === 'number') rawPrice = product.price;
        else if (typeof product.price === 'string') {
            rawPrice = parseFloat(product.price.replace('€', '').replace(',', '.').trim()) || 0;
        }

        // Logic 1: Pablo User
        if (user && user.isPablo) {
            const name = (product.name || '').toLowerCase();
            // User: "If Pablo Flatrate... pay exact 4.00 for Pablo products... EXCEPT if product is over 4.00, then pay rounded up."
            // Wait, previous audio said: "Pay 4€... except if > 5 euro it's rounded up".
            // Step 372 Audio: "products that have Pablo in name... exactly 4 euro. EXCEPT... if product is > 4 euro... then they pay rounded up".
            // So: 
            // If Name='Pablo' AND Price <= 4.00 -> 4.00.
            // If Name='Pablo' AND Price > 4.00 -> Round Up. (e.g. 4.50 -> 5.00).
            // (Assuming rounding rule >= 4.01 -> 5.00).

            if (name.includes('pablo')) {
                if (rawPrice > 4.00) {
                    return Math.ceil(rawPrice);
                } else {
                    return 4.00; // Flat 4.00 even if it was 3.50? User said "Exakt 4 Euro".
                }
            }
        }

        // Logic 2: Standard Rule (Everyone else OR Non-Pablo products for Pablo users)
        // Under 5.00 -> 5.00
        // Over 5.00 -> Round Up
        if (rawPrice < 5.00) {
            return 5.00;
        } else if (rawPrice > 5.00) {
            return Math.ceil(rawPrice);
        }

        return rawPrice; // Exactly 5.00
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

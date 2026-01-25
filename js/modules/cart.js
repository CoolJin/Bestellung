// --- js/modules/cart.js ---
import { UI } from './ui.js';

export const Cart = {
    addToCartLogic(product, state, updateCartCount) {
        if (!product) return;
        const existing = state.products.find(p => String(p.id) === String(product.id));
        if (!existing) {
            state.products.push(product);
        }
        this.addToCart(product.id, product.quantity || 1, state, updateCartCount);
    },

    addToCart(productId, qty = 1, state, updateCartCount) {
        const product = state.products.find(p => String(p.id) === String(productId));
        if (!product) return;
        const existing = state.cart.find(i => String(i.id) === String(productId));
        if (existing) existing.quantity = (existing.quantity || 1) + qty;
        else state.cart.push({ ...product, quantity: qty });
        updateCartCount();
        UI.showModal('Hinzugefügt', product.name);
    },

    updateCartCount(state, elements) {
        const total = state.cart.reduce((s, i) => s + (i.quantity || 1), 0);
        if (elements.cartCount) elements.cartCount.textContent = total;
    },

    changeCartQty(index, delta, state, renderCart, updateCartCount) {
        const item = state.cart[index];
        if (item) {
            item.quantity = (item.quantity || 1) + delta;
            if (item.quantity <= 0) state.cart.splice(index, 1);
            renderCart();
            updateCartCount();
        }
    },

    async placeOrder(state, DB, elements, updateCartCount, navigateTo) {
        if (state.cart.length === 0) return UI.showModal('Fehler', 'Warenkorb leer');
        const newId = DB.generateOrderId(state.editingOrderId);

        // Calculate Total
        const totalVal = state.cart.reduce((acc, item) => {
            let p = 0;
            if (item.price && typeof item.price === 'string') {
                p = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            }
            return acc + (p * (item.quantity || 1));
        }, 0);

        const order = {
            id: newId,
            user: state.currentUser.username,
            items: JSON.parse(JSON.stringify(state.cart)),
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
            updateCartCount();
            navigateTo('profile');
            UI.showModal('Erfolg', 'Bestellung ' + newId);
        } catch (e) {
            UI.showModal('Fehler', e.message);
        }
    }
};

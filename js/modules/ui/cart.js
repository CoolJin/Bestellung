// --- js/modules/ui/cart.js ---
export const CartUI = {
    renderCart(elements, state, changeCartQty) {
        const el = elements.cartItems;
        if (!el) return;
        el.innerHTML = '';

        let cartTotal = 0;

        state.cart.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'cart-item';

            // Calculate Item Totals
            let unitPrice = 0;
            // Parse price "3,45 €" -> 3.45 float
            if (item.price && typeof item.price === 'string') {
                unitPrice = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            }
            const lineSum = unitPrice * (item.quantity || 1);
            cartTotal += lineSum;

            const lineTotalStr = lineSum.toFixed(2).replace('.', ',');
            const displayUnit = item.price || '0,00 €';

            div.innerHTML = `
                <div style="flex:1">
                    <div style="display:flex; justify-content: flex-start; align-items: center; gap: 10px; margin-bottom: 4px;">
                        <b>${item.name}</b>
                        <span style="font-size: 0.85em; color: var(--text-muted);">${displayUnit} / Stück</span>
                    </div>
                    <div style="font-weight: 700;">
                        ${lineTotalStr} €
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    <button class="btn btn-secondary btn-sm" onclick="window.app.changeCartQty(${index}, -1)">-</button>
                    <span style="margin:0 10px">${item.quantity || 1}</span>
                    <button class="btn btn-secondary btn-sm" onclick="window.app.changeCartQty(${index}, 1)">+</button>
                </div>
           `;
            el.appendChild(div);
        });

        if (state.cart.length === 0) {
            el.innerHTML = '<p>Leer</p>';
            if (elements.cartTotal) elements.cartTotal.textContent = '0,00 €';
        } else {
            if (elements.cartTotal) elements.cartTotal.textContent = 'Gesamt: ' + cartTotal.toFixed(2).replace('.', ',') + ' €';
        }
    }
};

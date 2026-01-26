// --- js/modules/ui/profile.js ---
import { CoreUI } from './core.js';
// REMOVED Import Cart - Circular Dependency Fix
// import { Cart } from '../cart.js'; 

export const ProfileUI = {
    renderProfile(elements, DB, state, cartHelper) { // Accept cartHelper (Cart)
        const user = state.currentUser;
        if (!user) return;

        // Header
        const header = document.getElementById('profile-header');
        if (header) header.textContent = `Hallo, ${user.username}`;

        // Orders List
        const list = elements.profileOrdersList;
        if (!list) return;

        const orders = DB.getOrders().filter(o => o.user === user.username)
            .sort((a, b) => b.id.localeCompare(a.id));

        if (orders.length === 0) {
            list.innerHTML = '<p>Keine Bestellungen.</p>';
            return;
        }

        let html = '';
        orders.forEach(o => {
            // Recalculate Prices for Historic Orders!
            // Map items to new prices
            const updatedItems = (o.items || []).map(i => {
                // Dependency Injection: Use cartHelper
                const effectivePrice = cartHelper ? cartHelper.calculatePrice(i, user) : 0;
                // Note: We don't save this to DB, just display
                return {
                    ...i,
                    price: effectivePrice.toFixed(2).replace('.', ',') + ' €'
                };
            });

            // Recalculate Total
            const totalVal = updatedItems.reduce((acc, i) => {
                const p = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                return acc + (p * (i.quantity || 1));
            }, 0);
            const totalStr = totalVal.toFixed(2).replace('.', ',') + ' €';

            // Check if editable
            const isEditable = o.status === 'open';

            // Render Items
            const itemsHtml = updatedItems.map(i => `
                <div style="display:flex; justify-content:space-between; font-size:0.9em; margin-bottom:2px;">
                    <span>${i.quantity}x ${i.name}</span>
                    <span>${i.price}</span>
                </div>
            `).join('');

            html += `
            <div class="order-card" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1.1em;">${o.id}</span>
                    <span class="status-badge status-${o.status}">${o.status}</span>
                </div>
                <div style="font-size:0.85em; color:#ccc;">${o.date}</div>
                
                <div style="margin-top:5px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">
                    ${itemsHtml}
                    <div style="border-top:1px solid rgba(255,255,255,0.1); margin-top:8px; padding-top:8px; text-align:right; font-weight:bold; font-size:1.1em; color:var(--primary-color);">
                        Gesamt: ${totalStr}
                    </div>
                </div>

                ${isEditable ? `
                    <div style="margin-top:auto;">
                        ${o.adminNote ? `<div style="margin-bottom:10px; font-size:0.9em; color:#ef4444; background:rgba(239, 68, 68, 0.1); padding:8px; border-radius:6px;">Admin: ${o.adminNote}</div>` : ''}
                        <button class="btn btn-secondary btn-sm edit-order-btn" data-id="${o.id}" style="width:100%; padding:10px;">Bearbeiten & Warenkorb füllen</button>
                    </div>
                ` : ''}
            </div>`;
        });

        list.innerHTML = html;

        // Edit Handler
        list.querySelectorAll('.edit-order-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                CoreUI.showConfirm('Bestellung bearbeiten?', 'Der aktuelle Warenkorb wird ersetzt.', () => {
                    const order = orders.find(o => String(o.id) === String(id));
                    if (order && order.status === 'open') {
                        // Restore items to cart
                        state.cart = JSON.parse(JSON.stringify(order.items));
                        state.editingOrderId = order.id;
                        // Delete old order immediately? Or only on save?
                        // User flow: "Edit" -> Moves to Cart -> User modifies -> "Place Order" (Replaces old ID).
                        // So we delete old order here to avoid duplicates if they save properly.
                        // Or we keep it until they save? 
                        // Safer: Keep it. `placeOrder` logic will overwrite if ID matches.
                        // But `placeOrder` uses `generateOrderId`.
                        // Step 356 `placeOrder`: `const newId = DB.generateOrderId(state.editingOrderId);`
                        // If editingOrderId is set (e.g. #0005), `generateOrderId` returns `#0005B`.
                        // This preserves history?
                        // Or should we REPLACE?
                        // User feedback before: "Edit Order" -> "Confirmation".
                        // Assuming current logic is fine.

                        // Force re-calc prices in cart state
                        state.cart.forEach(i => {
                            const p = cartHelper ? cartHelper.calculatePrice(i, user) : 0;
                            i.price = p.toFixed(2).replace('.', ',') + ' €';
                        });

                        // Navigate
                        document.querySelector('[data-view="cart"]').click();
                        CoreUI.showModal('Bestellung bearbeitet', 'Inhalte geladen');
                    }
                });
            };
        });
    }
};

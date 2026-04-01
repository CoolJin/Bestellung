// --- js/modules/ui/orders.js ---
export const OrdersUI = {
    createOrderCard(order, isArchived, isCancelledSection) {
        const card = document.createElement('div');
        card.className = 'order-card';

        let btns = '';
        if (isArchived) {
            btns = `<glass-surface class="btn btn-secondary btn-sm restore-order" data-id="${order.id}">Wiederherstellen</glass-surface>
                    <glass-surface class="btn btn-danger btn-sm delete-order" data-id="${order.id}">Löschen</glass-surface>`;
        } else if (order.status === 'cancelled') {
            // User wants "Erneut bestellen" (Restore) and "Löschen"
            btns = `<glass-surface class="btn btn-secondary btn-sm revive-order" data-id="${order.id}">Erneut bestellen</glass-surface>
                    <glass-surface class="btn btn-danger btn-sm delete-order" data-id="${order.id}">Löschen</glass-surface>`;
        } else {
            // Active
            if (order.status === 'open' || order.status === 'captured') {
                btns = `<glass-surface class="btn btn-primary btn-sm edit-order" data-id="${order.id}">Bearbeiten</glass-surface>
                        <glass-surface class="btn btn-danger btn-sm cancel-order" data-id="${order.id}" style="margin-left:5px">Stornieren</glass-surface>`;
            } else {
                btns = `<glass-surface class="btn btn-secondary btn-sm archive-order" data-id="${order.id}">Archivieren</glass-surface>`;
            }
        }

        // on-the-fly calc for legacy orders
        let displayTotal = order.total;
        if (!displayTotal || displayTotal === '0' || displayTotal === 0) {
            let sum = 0;
            if (order.items && order.items.length > 0) {
                sum = order.items.reduce((acc, i) => {
                    let price = 0;
                    if (i.price && typeof i.price === 'string') {
                        price = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                    }
                    return acc + (price * (i.quantity || 1));
                }, 0);
            }
            displayTotal = sum.toFixed(2).replace('.', ',') + ' €';
        }

        // Date Format: Remove Seconds
        let dateStr = order.date;
        try {
            // Assume format "D.M.YYYY, HH:MM:SS"
            const parts = dateStr.split(', ');
            if (parts.length > 1) {
                const timeParts = parts[1].split(':');
                if (timeParts.length >= 2) {
                    dateStr = `${parts[0]}, ${timeParts[0]}:${timeParts[1]}`;
                }
            }
        } catch (e) { }

        card.innerHTML = `
            <div class="order-header">
                <span class="order-id-span">
                    ${order.id} 
                    <span class="status-badge status-${order.status}">${order.status}</span>
                    ${order.status === 'bestellt' ? `<span class="status-badge ${order.paid ? 'status-paid' : 'status-unpaid'}">${order.paid ? 'Bezahlt' : 'Nicht bezahlt'}</span>` : ''}
                </span>
                <span>${dateStr}</span>
            </div>
            <div class="order-body">
                 <ul class="order-items-list">
                    ${order.items.map(i => {
            let p = i.price || '0,00 €';
            return `<li>
                            <div style="display:grid; grid-template-columns: 1fr auto; gap: 20px; width:100%">
                                <span>${i.quantity}x ${i.name}</span>
                                <span class="text-muted" style="font-size:0.9em">${p} / Stück</span>
                            </div>
                        </li>`;
        }).join('')}
                 </ul>
                 <div class="order-footer-total" style="text-align:right; margin-top:10px; font-weight:600; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                    Gesamt: ${displayTotal}
                 </div>
                 ${order.adminNote ? `<div style="margin-top:10px; background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; font-size:0.9em;"><strong style="display:block; font-size:0.8em; color:var(--primary-color);">Nachricht vom Admin:</strong>${order.adminNote}</div>` : ''}
                 <div style="text-align:right; margin-top:10px">${btns}</div>
            </div>
        `;
        return card;
    },

    createCollapsible(title, orders, isArchive, isOpen = false, type = '') {
        const div = document.createElement('div');
        div.className = 'archive-container';
        if (type) div.dataset.type = type;

        div.innerHTML = `<div class="archive-header" onclick="this.nextElementSibling.classList.toggle('open')"><span>${title} (${orders.length})</span><span>▼</span></div><div class="archive-list ${isOpen ? 'open' : ''}"></div>`;
        const container = div.querySelector('.archive-list');
        orders.forEach(o => container.appendChild(this.createOrderCard(o, isArchive, title === 'Storniert')));
        return div;
    }
};

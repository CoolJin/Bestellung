// --- js/modules/ui/profile.js ---
import { CoreUI } from './core.js';

export const ProfileUI = {
    renderProfile(elements, DB, state, cartHelper) {
        const user = state.currentUser;
        if (!user) return;

        // Header
        const header = document.getElementById('profile-header');
        if (header) header.textContent = `Hallo, ${user.username}`;

        // Container
        const list = elements.profileOrdersList;
        if (!list) return;

        // Persist Accordion State
        const isArchOpen = list.dataset.archOpen === 'true';
        const isCancOpen = list.dataset.cancOpen === 'true';

        const allOrders = DB.getOrders().filter(o => o.user === user.username)
            .sort((a, b) => b.id.localeCompare(a.id));

        if (allOrders.length === 0) {
            list.innerHTML = '<p>Keine Bestellungen.</p>';
            return;
        }

        // Segregate Orders
        const activeOrders = [];
        const archivedOrders = [];
        const cancelledOrders = [];

        allOrders.forEach(o => {
            const archivedList = o.archivedBy || [];

            const isDeleted = archivedList.includes('DELETED:' + user.username);
            const isArchived = archivedList.includes(user.username);
            const isCancelled = o.status === 'cancelled';

            if (isDeleted) return; // Skip deleted

            if (isCancelled) {
                cancelledOrders.push(o);
            } else if (isArchived) {
                archivedOrders.push(o);
            } else {
                activeOrders.push(o);
            }
        });

        // Helper to Render Order Card
        const renderCard = (o, type) => {
            // Recalculate Prices
            const updatedItems = (o.items || []).map(i => {
                const effectivePrice = cartHelper ? cartHelper.calculatePrice(i, user) : 0;
                return {
                    ...i,
                    price: effectivePrice.toFixed(2).replace('.', ',') + ' €'
                };
            });

            // Total
            const totalVal = updatedItems.reduce((acc, i) => {
                const p = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                return acc + (p * (i.quantity || 1));
            }, 0);
            const totalStr = totalVal.toFixed(2).replace('.', ',') + ' €';

            // Items HTML
            const itemsHtml = updatedItems.map(i => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9em; margin-bottom:5px;">
                    <span style="padding-right:15px;">${i.quantity}x ${i.name}</span>
                    <span style="white-space:nowrap; font-weight:600;">${i.price}</span>
                </div>
            `).join('');

            // Buttons based on Type
            let buttonsHtml = '';
            if (type === 'active') {
                // Archive Logic: Only if status is 'abgelehnt' or 'bestellt'
                const canArchive = o.status === 'abgelehnt' || o.status === 'bestellt';

                buttonsHtml = `
                    <div style="display:grid; grid-template-columns: 1fr ${canArchive ? '1fr' : ''}; gap:10px; margin-top:10px;">
                        <button class="btn btn-primary btn-sm edit-order" data-id="${o.id}">Bearbeiten</button>
                        ${canArchive ? `<button class="btn btn-primary btn-sm archive-order" data-id="${o.id}" style="width:100%">Archivieren</button>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm cancel-order" data-id="${o.id}" style="width:100%; margin-top:10px;">Stornieren</button>
                `;
            } else if (type === 'archived') {
                buttonsHtml = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                        <button class="btn btn-primary btn-sm restore-order" data-id="${o.id}">Wiederherstellen</button>
                        <button class="btn btn-danger btn-sm delete-order" data-id="${o.id}">Löschen</button>
                    </div>
                `;
            } else if (type === 'cancelled') {
                // Added Delete button for Cancelled orders
                buttonsHtml = `
                    <button class="btn btn-primary btn-sm revive-order" data-id="${o.id}" style="width:100%; margin-top:10px;">Erneut bestellen</button>
                    <button class="btn btn-danger btn-sm delete-order" data-id="${o.id}" style="width:100%; margin-top:5px;">Löschen</button>
                `;
            }

            const paidBadge = o.paid ?
                `<span class="status-badge" style="background:rgba(16, 185, 129, 0.2); color:#10b981; margin-left:10px; border:1px solid rgba(16, 185, 129, 0.3);">Bezahlt</span>` :
                `<span class="status-badge" style="background:rgba(244, 63, 94, 0.2); color:#f43f5e; margin-left:10px; border:1px solid rgba(244, 63, 94, 0.3);">Nicht bezahlt</span>`;

            return `
            <div class="order-card" style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center;">
                        <span style="font-weight:bold; font-size:1.2em; margin-right:10px;">${o.id}</span>
                        <span class="status-badge status-${o.status}">${o.status}</span>
                        ${o.paid !== undefined && o.status === 'bestellt' ? paidBadge : ''}
                    </div>
                <div style="font-size:0.85em; color:#ccc;">${o.date}</div>
                ${o.adminNote ? `<div style="font-size:0.9em; color:#ef4444; background:rgba(239, 68, 68, 0.1); padding:8px; border-radius:6px; margin:5px 0;">Admin: ${o.adminNote}</div>` : ''}
                ${o.note ? `<div style="font-size:0.9em; color:#ccc; background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; margin:5px 0 10px 0; font-style:italic;">"${o.note}"</div>` : ''}

                <div style="padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">
                    ${itemsHtml}
                    <div style="border-top:1px solid rgba(255,255,255,0.1); margin-top:8px; padding-top:8px; text-align:right; font-weight:bold; font-size:1.1em; color:var(--primary-color);">
                        Gesamt: ${totalStr}
                    </div>
                </div>

                <div style="margin-top:auto;">
                    ${buttonsHtml}
                </div>
            </div>`;
        };

        // Construct Full HTML
        let fullHtml = '';

        // 1. Active Orders
        if (activeOrders.length > 0) {
            fullHtml += `<h3>Aktuelle Bestellungen</h3>`;
            activeOrders.forEach(o => fullHtml += renderCard(o, 'active'));
        } else {
            fullHtml += `<h3>Aktuelle Bestellungen</h3><p style="color:#888;">Keine aktiven Bestellungen.</p>`;
        }

        // 2. Archived Orders (Accordion)
        fullHtml += `
        <details id="details-archive" style="margin-top:20px; background:rgba(255,255,255,0.02); border-radius:8px; overflow:hidden;" ${isArchOpen ? 'open' : ''}>
            <summary style="padding:15px; cursor:pointer; font-weight:bold; background:rgba(255,255,255,0.05);">Archivierte Bestellungen (${archivedOrders.length})</summary>
            <div style="padding:15px;">
                ${archivedOrders.length > 0 ? archivedOrders.map(o => renderCard(o, 'archived')).join('') : '<p style="color:#888;">Keine archivierten Bestellungen.</p>'}
            </div>
        </details>`;

        // 3. Cancelled Orders (Accordion)
        fullHtml += `
        <details id="details-cancelled" style="margin-top:10px; background:rgba(255,255,255,0.02); border-radius:8px; overflow:hidden;" ${isCancOpen ? 'open' : ''}>
            <summary style="padding:15px; cursor:pointer; font-weight:bold; background:rgba(255,255,255,0.05);">Stornierte Bestellungen (${cancelledOrders.length})</summary>
            <div style="padding:15px;">
                ${cancelledOrders.length > 0 ? cancelledOrders.map(o => renderCard(o, 'cancelled')).join('') : '<p style="color:#888;">Keine stornierten Bestellungen.</p>'}
            </div>
        </details>`;

        list.innerHTML = fullHtml;

        // Attach Toggle Listeners for Persistence
        const dArch = list.querySelector('#details-archive');
        if (dArch) dArch.ontoggle = () => list.dataset.archOpen = dArch.open;

        const dCanc = list.querySelector('#details-cancelled');
        if (dCanc) dCanc.ontoggle = () => list.dataset.cancOpen = dCanc.open;
    }
};

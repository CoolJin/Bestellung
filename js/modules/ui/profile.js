// --- js/modules/ui/profile.js ---
import { OrdersUI } from './orders.js';

export const ProfileUI = {
    renderProfile(elements, DB, state) {
        const list = elements.profileOrdersList;
        if (!list) return;

        // Check open states before clearing
        const cancelledOpen = list.querySelector('.archive-container[data-type="cancelled"] .archive-list.open') !== null;
        const archivedOpen = list.querySelector('.archive-container[data-type="archived"] .archive-list.open') !== null;

        list.innerHTML = '';

        const all = DB.getOrders().filter(o => o.user === state.currentUser.username).sort((a, b) => b.id.localeCompare(a.id));

        const active = all.filter(o => !o.archivedBy?.includes(state.currentUser.username) && o.status !== 'cancelled');
        const cancelled = all.filter(o => o.status === 'cancelled' && !o.archivedBy?.includes(state.currentUser.username));
        const archived = all.filter(o => o.archivedBy?.includes(state.currentUser.username));

        active.forEach(o => list.appendChild(OrdersUI.createOrderCard(o)));

        if (cancelled.length > 0) {
            list.appendChild(OrdersUI.createCollapsible('Storniert', cancelled, false, cancelledOpen, 'cancelled'));
        }

        if (archived.length > 0) {
            list.appendChild(OrdersUI.createCollapsible('Archiv', archived, true, archivedOpen, 'archived'));
        }
    }
};

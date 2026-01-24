// --- js/modules/ui.js ---
export const UI = {
    showModal(title, msg) {
        const existing = document.querySelector('.notification-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'notification-modal';
        modal.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-msg">${msg}</div>
                <button class="btn btn-primary" onclick="this.closest('.notification-modal').remove()">Ok</button>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => {
            if (modal && modal.parentElement) modal.remove();
        }, 3000);
    },

    showConfirm(title, msg, onConfirm) {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content glass-panel">
                <h3>${title}</h3>
                <p>${msg}</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Abbrechen</button>
                    <button class="btn btn-primary" id="confirm-yes-btn">Ja</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('confirm-yes-btn').onclick = () => {
            onConfirm();
            modal.remove();
        };
    },

    renderCatalog(elements, state) {
        const grid = elements.productGrid;
        if (!grid) return;
        grid.innerHTML = '';

        if (state.products.length > 0) {
            state.products.forEach(p => {
                const card = document.createElement('article');
                card.className = 'product-card';
                card.innerHTML = `
                     <img src="${p.image}" class="product-image" alt="${p.name}">
                     <div class="product-info">
                         <h3>${p.name}</h3>
                         <div class="product-footer">
                             <div class="product-price">${p.price || 'Kein Preis'}</div>
                             <button class="btn btn-primary btn-sm add-to-cart" data-id="${p.id}">Hinzufügen</button>
                         </div>
                     </div>
                 `;
                grid.appendChild(card);
            });
        }
    },

    renderCart(elements, state, changeCartQty) {
        const el = elements.cartItems;
        if (!el) return;
        el.innerHTML = '';
        state.cart.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'cart-item';

            // Calculate Item Totals
            let unitPrice = 0;
            // Parse price "3,45 €" -> 3.45 float
            if (item.price && typeof item.price === 'string') {
                unitPrice = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            }
            const lineTotal = (unitPrice * (item.quantity || 1)).toFixed(2).replace('.', ',');
            const displayUnit = item.price || '0,00 €';

            div.innerHTML = `
                <div style="flex:1">
                    <b>${item.name}</b>
                    <div style="font-size: 0.85em; color: var(--text-muted); margin-top: 4px;">
                        ${displayUnit} x ${item.quantity || 1} = <b>${lineTotal} €</b>
                    </div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="window.app.changeCartQty(${index}, -1)">-</button>
                    <span style="margin:0 10px">${item.quantity || 1}</span>
                    <button class="btn btn-secondary btn-sm" onclick="window.app.changeCartQty(${index}, 1)">+</button>
                </div>
           `;
            el.appendChild(div);
        });
        if (state.cart.length === 0) el.innerHTML = '<p>Leer</p>';
        if (elements.cartTotal) elements.cartTotal.textContent = '...';
    },

    renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard) {
        const list = elements.ordersList;
        if (!list) return;
        list.innerHTML = '';
        const orders = DB.getOrders();
        if (orders.length === 0) {
            list.innerHTML = '<p>Keine Bestellungen.</p>';
            return;
        }
        orders.forEach(o => {
            const div = document.createElement('div');
            div.className = 'order-card';
            div.innerHTML = `
                <div style="flex:1">
                    <b>${o.id}</b> <span class="text-muted">(${o.user})</span>
                    <span class="status-badge status-${o.status}" style="margin-left:10px">${o.status}</span>
                    <div style="font-size:0.85rem; margin-top:5px">
                       ${o.items.map(i => i.quantity + 'x ' + i.name).join(', ')}
                    </div>
                </div>
                <div style="display:flex; gap:5px">
                    <button class="btn btn-danger btn-sm delete-order" data-id="${o.id}">Löschen</button>
                </div>
             `;
            list.appendChild(div);
        });
    },

    renderSearchResults(products, elements) {
        const grid = elements.snuzoneResultsGrid;
        if (!grid) return;
        grid.innerHTML = '';

        if (products.length === 0) {
            grid.innerHTML = '<p>Keine Produkte gefunden.</p>';
            return;
        }

        products.forEach((p, index) => {
            const card = document.createElement('article');
            card.className = `product-card ${p.soldOut ? 'sold-out' : ''}`;
            card.innerHTML = `
                ${p.soldOut ? '<div class="sold-out-badge">Ausverkauft</div>' : ''}
                <img src="${p.image}" class="product-image" alt="${p.name}">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="product-footer">
                         <div class="product-price">${p.price}</div>
                        ${!p.soldOut ? `<button class="btn btn-primary btn-sm add-external" data-index="${index}">Hinzufügen</button>` : '<button disabled class="btn btn-secondary btn-sm">N/A</button>'}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    createOrderCard(order, isArchived, isCancelledSection) {
        const card = document.createElement('div');
        card.className = 'order-card';

        let btns = '';
        if (isArchived) {
            btns = `<button class="btn btn-secondary btn-sm restore-order" data-id="${order.id}">Wiederherstellen</button>
                    <button class="btn btn-danger btn-sm delete-order" data-id="${order.id}">Löschen</button>`;
        } else if (order.status === 'cancelled') {
            btns = `<button class="btn btn-secondary btn-sm archive-order" data-id="${order.id}">Archivieren</button>`;
        } else {
            // Active
            if (order.status === 'open' || order.status === 'captured') {
                btns = `<button class="btn btn-primary btn-sm edit-order" data-id="${order.id}">Bearbeiten</button>
                        <button class="btn btn-danger btn-sm cancel-order" data-id="${order.id}" style="margin-left:5px">Stornieren</button>`;
            } else {
                btns = `<button class="btn btn-secondary btn-sm archive-order" data-id="${order.id}">Archivieren</button>`;
            }
        }

        card.innerHTML = `
            <div class="order-header">
                <span>${order.id} <span class="status-badge status-${order.status}">${order.status}</span></span>
                <span>${order.date}</span>
            </div>
            <div class="order-body">
                 <ul>${order.items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('')}</ul>
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
    },

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

        active.forEach(o => list.appendChild(this.createOrderCard(o)));

        if (cancelled.length > 0) {
            list.appendChild(this.createCollapsible('Storniert', cancelled, false, cancelledOpen, 'cancelled'));
        }

        if (archived.length > 0) {
            list.appendChild(this.createCollapsible('Archiv', archived, true, archivedOpen, 'archived'));
        }
    }
};

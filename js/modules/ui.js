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
    },

    renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard) {
        const list = elements.ordersList;
        if (!list) return;

        // --- Tab Navigation ---
        let activeTab = list.dataset.activeTab || 'orders';
        let selectedUserFilter = list.dataset.selectedUser || null;

        list.innerHTML = `
            <div class="admin-tabs" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--glass-border); padding-bottom:10px;">
                <button class="btn btn-sm ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} tab-btn" data-tab="orders">Bestellungen</button>
                <button class="btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} tab-btn" data-tab="users">Benutzer</button>
            </div>
            <div id="admin-content-area"></div>
        `;

        const content = list.querySelector('#admin-content-area');

        // Event Listeners for Tabs
        list.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                list.dataset.activeTab = btn.dataset.tab;
                if (btn.dataset.tab === 'orders') list.dataset.selectedUser = '';
                renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard);
            };
        });

        // --- USERS TAB ---
        if (activeTab === 'users') {
            content.innerHTML = `
                <div class="user-management-panel">
                    <h3>Benutzer verwalten</h3>
                    
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px;">
                        <h4>Neuen Benutzer anlegen</h4>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <input type="text" id="new-user-name" placeholder="Benutzername" style="flex:1; min-width:150px;">
                            <input type="text" id="new-user-pass" placeholder="Passwort" style="flex:1; min-width:150px;">
                            <button id="create-user-btn" class="btn btn-primary">Erstellen</button>
                        </div>
                    </div>

                    <div class="user-list" style="display:grid; gap:10px;">
                        ${DB.getUsers().map(u => `
                            <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:bold;">${u.username} <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span></div>
                                    <div style="font-size:0.9em; color:#aaa;">Passwort: ${u.password}</div>
                                </div>
                                <div style="display:flex; gap:5px;">
                                    ${u.role !== 'admin' ? `<button class="btn btn-sm btn-secondary view-user-orders" data-user="${u.username}">Bestellungen</button>` : ''}
                                    ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Handlers
            content.querySelector('#create-user-btn').onclick = () => {
                const nameIn = content.querySelector('#new-user-name');
                const passIn = content.querySelector('#new-user-pass');
                const username = nameIn.value.trim();
                const password = passIn.value.trim();
                if (!username || !password) return UI.showModal('Fehler', 'Bitte Name und Passwort eingeben');
                try {
                    DB.createUser(username, password);
                    renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard);
                } catch (e) {
                    UI.showModal('Fehler', e.message);
                }
            };
            content.querySelectorAll('.delete-user').forEach(btn => {
                btn.onclick = () => {
                    const u = btn.dataset.user;
                    UI.showConfirm('Benutzer löschen?', `Benutzer "${u}" wirklich löschen?`, () => {
                        DB.deleteUser(u);
                        renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard);
                    });
                };
            });
            content.querySelectorAll('.view-user-orders').forEach(btn => {
                btn.onclick = () => {
                    list.dataset.activeTab = 'orders';
                    list.dataset.selectedUser = btn.dataset.user;
                    renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard);
                };
            });
            return;
        }

        // --- ORDERS TAB ---
        let orders = DB.getOrders().sort((a, b) => b.id.localeCompare(a.id));

        if (selectedUserFilter && selectedUserFilter !== 'null' && selectedUserFilter !== '') {
            orders = orders.filter(o => o.user === selectedUserFilter);
            content.innerHTML += `
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(56, 189, 248, 0.1); padding:10px; border-radius:8px; border:1px solid var(--primary-color);">
                    <span>Filter: <strong>${selectedUserFilter}</strong> (${orders.length} Bestellungen)</span>
                    <button class="btn btn-sm btn-secondary" id="clear-filter-btn">Filter löschen</button>
                </div>
            `;
            setTimeout(() => {
                const cfBtn = content.querySelector('#clear-filter-btn');
                if (cfBtn) cfBtn.onclick = () => {
                    list.dataset.selectedUser = '';
                    renderAdminDashboard(elements, DB, showConfirm, renderAdminDashboard);
                };
            }, 0);
        }

        if (orders.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Keine Bestellungen gefunden.';
            content.appendChild(msg);
            return;
        }

        orders.forEach(o => {
            // Calc Total
            let displayTotal = o.total;
            if (!displayTotal || displayTotal === '0' || displayTotal === 0 || displayTotal === '0,00 €') {
                let sum = 0;
                if (o.items && o.items.length > 0) {
                    sum = o.items.reduce((acc, i) => {
                        let price = 0;
                        if (i.price && typeof i.price === 'string') {
                            price = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                        }
                        return acc + (price * (i.quantity || 1));
                    }, 0);
                }
                displayTotal = sum.toFixed(2).replace('.', ',') + ' €';
            }

            // Date Format: Remove Seconds if present (DD.MM.YYYY, HH:MM:SS -> HH:MM)
            let dateStr = o.date;
            try {
                const parts = dateStr.split(', ');
                if (parts.length > 1) {
                    const timeParts = parts[1].split(':');
                    if (timeParts.length === 3) dateStr = `${parts[0]}, ${timeParts[0]}:${timeParts[1]}`;
                }
            } catch (e) { }

            const div = document.createElement('div');
            div.className = 'order-card';
            div.innerHTML = `
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <b>${o.id}</b> <span class="text-muted">(${o.user})</span>
                            <span class="status-badge status-${o.status}" style="margin-left:8px">${o.status}</span>
                        </div>
                        <div style="font-weight:600;">${displayTotal}</div>
                    </div>
                    <div style="font-size:0.8rem; color: #888; margin-bottom: 5px;">${dateStr}</div>
                    
                    <div style="font-size:0.85rem; margin-top:5px; color:var(--text-muted);">
                       ${o.items.map(i => {
                let unitPrice = 0;
                if (i.price && typeof i.price === 'string') {
                    unitPrice = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                }
                const lineSum = unitPrice * (i.quantity || 1);
                const lineTotalStr = lineSum.toFixed(2).replace('.', ',') + ' €';
                const displayUnit = i.price || '0,00 €';

                return `
                           <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
                                <div style="display:flex; gap: 15px;">
                                    <span>${i.quantity}x ${i.name}</span>
                                    <span class="text-muted">${displayUnit} / Stk.</span>
                                </div>
                                <span>${lineTotalStr}</span>
                           </div>`;
            }).join('')}
                    </div>

                    <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">
                        <label style="font-size:0.8em; color:var(--text-muted);">Admin Notiz:</label>
                        <textarea class="form-control admin-note-input" data-id="${o.id}" rows="2" placeholder="Notiz für Kunden..." style="resize: none; background: #fff; color: #333; font-weight: 500;">${o.adminNote || ''}</textarea>
                        <button class="btn btn-secondary btn-sm save-note-btn" data-id="${o.id}" style="margin-top:5px; width:100%;">Notiz Speichern</button>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; min-width: 130px;">
                    <button class="btn btn-sm reject-order" data-id="${o.id}" data-status="${o.status}" 
                        style="${o.status === 'abgelehnt' ? 'background: #ef4444; color: white; border:1px solid #ef4444' : 'background: transparent; color: #ef4444; border: 1px solid #ef4444'}">
                        Ablehnen
                    </button>
                    <button class="btn btn-sm confirm-order" data-id="${o.id}" data-status="${o.status}"
                        style="${o.status === 'bestellt' ? 'background: var(--primary-color); color: #0f172a; border:1px solid var(--primary-color)' : 'background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color)'}">
                        Bestellt
                    </button>
                    ${o.status === 'bestellt' ?
                    `<button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" style="margin-top:5px; border-color: ${o.paid ? '#22c55e' : '#ef4444'}; color: ${o.paid ? '#22c55e' : '#ef4444'}">
                            ${o.paid ? 'Bezahlt' : 'Nicht bezahlt'}
                        </button>`
                    : ''}
                </div>
             `;
            content.appendChild(div);
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
            // User wants "Erneut bestellen" (Restore) and "Löschen"
            btns = `<button class="btn btn-secondary btn-sm revive-order" data-id="${order.id}">Erneut bestellen</button>
                    <button class="btn btn-danger btn-sm delete-order" data-id="${order.id}">Löschen</button>`;
        } else {
            // Active
            if (order.status === 'open' || order.status === 'captured') {
                btns = `<button class="btn btn-primary btn-sm edit-order" data-id="${order.id}">Bearbeiten</button>
                        <button class="btn btn-danger btn-sm cancel-order" data-id="${order.id}" style="margin-left:5px">Stornieren</button>`;
            } else {
                btns = `<button class="btn btn-secondary btn-sm archive-order" data-id="${order.id}">Archivieren</button>`;
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
                <!-- Header Total removed as per request -->
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

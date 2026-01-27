// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender, cartHelper) {
        const list = elements.ordersList;
        if (!list) return;

        let activeTab = list.dataset.activeTab || 'orders';
        let selectedUserFilter = list.dataset.selectedUser || null;

        const openAccordions = new Set();
        list.querySelectorAll('.role-accordion:not(.hidden)').forEach(acc => openAccordions.add(acc.id));

        // Use details 'open' attribute persistence via dataset
        const isArchiveOpen = list.dataset.archiveOpen === 'true';

        list.innerHTML = '';
        const content = document.createElement('div');
        list.appendChild(content);

        // --- Improved Modal ---
        const showAdminModal = (title, contentHTML, onConfirm) => {
            // ... Modal Logic (Keeping Same) ...
            const modalId = 'admin-dynamic-modal';
            let modal = document.getElementById(modalId);
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; justify-content:center; align-items:center;';
            modal.innerHTML = `
                <div class="modal-content glass-panel" style="background:#1e293b; padding:20px; border-radius:12px; min-width:300px; border:1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin-top:0;">${title}</h3>
                    <div style="margin:15px 0;">${contentHTML}</div>
                    <div class="modal-actions" style="display:flex; justify-content:flex-end; gap:10px;">
                        <button class="btn btn-secondary close-modal">Abbrechen</button>
                        <button class="btn btn-primary confirm-modal">Bestätigen</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const close = () => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); };
            modal.querySelector('.close-modal').onclick = close;
            modal.querySelector('.confirm-modal').onclick = () => { onConfirm(modal); close(); };
        };

        // --- USERS TAB (Unchanged logic, re-pasted for completeness) ---
        if (activeTab === 'users') {
            const users = DB.getUsers();
            content.innerHTML = `
                <div class="user-management-panel">
                    <h3>Benutzer verwalten</h3>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px;">
                        <h4>Neuen Benutzer anlegen</h4>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <input type="text" id="new-user-name" placeholder="Name" style="flex:1;">
                            <input type="text" id="new-user-pass" placeholder="Passwort" style="flex:1;">
                            <button id="create-user-btn" class="btn btn-primary">Erstellen</button>
                        </div>
                    </div>
                    <div class="user-list" style="display:grid; gap:10px;">
                        ${users.map(u => {
                const showOrdersBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-secondary view-user-orders" data-user="${u.username}">Bestellungen</button>` : '';
                const showDeleteBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : '';
                const nameColor = u.role === 'admin' ? 'var(--primary-color)' : 'var(--text-color)';
                const pabloLabel = u.isPablo ? '<span style="font-size:0.8em; color:var(--primary-color); margin-left:5px;">(Pablo-Flat)</span>' : '';
                const accordionId = `role-accordion-${u.username}`;
                const isAccordionOpen = openAccordions.has(accordionId);

                return `
                            <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:bold; color:${nameColor};">${u.username} <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span>${pabloLabel}</div>
                                        <div style="font-size:0.85em; color:var(--text-muted); margin-top:2px;">Passwort: ${u.password}</div>
                                    </div>
                                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                                        ${showOrdersBtn}
                                        <button class="btn btn-sm btn-secondary edit-pw-btn" data-user="${u.username}">Passwort ändern</button>
                                        <button class="btn btn-sm btn-secondary manage-role-btn" data-user="${u.username}">Rollen</button>
                                        ${showDeleteBtn}
                                    </div>
                                </div>
                                <div class="role-accordion ${isAccordionOpen ? '' : 'hidden'}" id="${accordionId}" style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px;">
                                     <div style="display:flex; flex-direction:column; gap:8px;">
                                        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="event.stopPropagation()">
                                            <input type="checkbox" class="role-checkbox" data-role="admin" data-user="${u.username}" ${u.role === 'admin' ? 'checked' : ''}>
                                            <span class="checkmark"></span><span style="color:white;">Administrator</span>
                                        </label>
                                        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="event.stopPropagation()">
                                            <input type="checkbox" class="pablo-checkbox" data-user="${u.username}" ${u.isPablo ? 'checked' : ''}>
                                            <span class="checkmark"></span><span style="color:white;">Pablo Flatrate</span>
                                        </label>
                                     </div>
                                </div>
                            </div>`;
            }).join('')}
                    </div>
                </div>`;
            AdminUI.setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal, cartHelper);
            return;
        }

        // --- ORDERS TAB ---
        let allOrders = DB.getOrders().filter(o => !o.deletedByAdmin).sort((a, b) => b.id.localeCompare(a.id));
        const activeOrders = allOrders.filter(o => !o.adminArchived);
        const archivedOrders = allOrders.filter(o => o.adminArchived);
        const products = DB.state.products || [];

        let displayOrders = activeOrders;
        if (selectedUserFilter) {
            displayOrders = displayOrders.filter(o => o.user === selectedUserFilter);
            content.innerHTML += `
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(56, 189, 248, 0.1); padding:10px; border-radius:8px; border:1px solid var(--primary-color);">
                    <span>Filter: <strong>${selectedUserFilter}</strong> (${displayOrders.length})</span>
                    <button class="btn btn-sm btn-secondary" id="clear-filter-btn">Filter löschen</button>
                </div>`;
            setTimeout(() => {
                const cfBtn = content.querySelector('#clear-filter-btn');
                if (cfBtn) cfBtn.onclick = () => {
                    list.dataset.selectedUser = '';
                    selfRender(elements, DB, showConfirm, selfRender, cartHelper);
                };
            }, 0);
        }

        const renderOrderCard = (o, isArchive) => {
            let total = o.total;
            const statusClass = `status-${o.status}`;
            const btnStyle = o.status === 'bestellt' ? 'border-color:var(--primary-color); color:var(--primary-color)' : '';

            // Layout fix for Archive
            const cardBg = isArchive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
            const cardOpacity = isArchive ? '0.75' : '1';

            // Formatting Time (HH:MM)
            let dateStr = o.date;
            try {
                const p = dateStr.split(', ');
                if (p.length > 1) {
                    const t = p[1].split(':');
                    if (t.length >= 2) dateStr = `${p[0]}, ${t[0]}:${t[1]}`;
                }
            } catch (e) { }

            // Items with Admin Price Comparison (Using cartHelper)
            const itemsHtml = (o.items || []).map(i => {
                // ... (Price comparison logic same as before) ...
                let origPrice = 0;
                const catItem = products.find(p => String(p.id) === String(i.id));
                if (catItem) {
                    if (typeof catItem.price === 'number') origPrice = catItem.price;
                    else if (typeof catItem.price === 'string')
                        origPrice = parseFloat(catItem.price.replace('ue', '').replace(',', '.').trim()) || 0;
                }
                const orderUser = DB.getUsers().find(u => u.username === o.user);
                let userPrice = 0;
                if (cartHelper && orderUser) {
                    userPrice = cartHelper.calculatePrice(i, orderUser);
                } else {
                    if (i.price && typeof i.price === 'string')
                        userPrice = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                }
                const userPriceStr = userPrice.toFixed(2).replace('.', ',') + ' €';
                const origPriceStr = origPrice.toFixed(2).replace('.', ',') + ' €';
                let priceDisplay = `<span>${userPriceStr}</span>`;
                if (Math.abs(origPrice - userPrice) > 0.01 && origPrice > 0) {
                    priceDisplay = `<span style="text-decoration:line-through; color:#888; margin-right:8px;">${origPriceStr}</span><span style="color:var(--primary-color); font-weight:bold;">${userPriceStr}</span>`;
                }
                return `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${i.quantity}x ${i.name}</span><div>${priceDisplay}</div></div>`;
            }).join('');

            let btns = '';
            // CANCELLED LOGIC: If cancelled, RESTRICT actions
            const isCancelled = o.status === 'cancelled';

            if (isArchive) {
                btns = `
                    <button class="btn btn-secondary btn-sm unarchive-order" data-id="${o.id}">Wiederherstellen</button>
                    <button class="btn btn-danger btn-sm delete-permanent" data-id="${o.id}">Löschen</button>
                 `;
            } else if (isCancelled) {
                // Cancelled: ONLY Show Archive
                btns = `
                    <div style="font-weight:bold; color:#ef4444; margin-bottom:5px; text-align:center;">STORNIERT</div>
                    <button class="btn btn-secondary btn-sm archive-order-btn" data-id="${o.id}" style="width:100%;">Archivieren</button>
                `;
            } else {
                // Normal Active logic
                btns = `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn btn-sm reject-order" data-id="${o.id}" data-status="${o.status}" 
                            style="background-color: ${o.status === 'abgelehnt' ? '#ef4444' : 'transparent'}; 
                                   border: 1px solid #ef4444; color: ${o.status === 'abgelehnt' ? 'white' : '#ef4444'}; width:100%;">
                            ${o.status === 'abgelehnt' ? 'Abgelehnt' : 'Ablehnen'}
                        </button>
                        
                        <button class="btn btn-sm confirm-order" data-id="${o.id}" data-status="${o.status}" 
                             style="background-color: ${o.status === 'bestellt' ? '#22c55e' : 'transparent'}; 
                                    border: 1px solid #22c55e; color: ${o.status === 'bestellt' ? 'white' : '#22c55e'}; width:100%;">
                            ${o.status === 'bestellt' ? 'Bestätigt' : 'Bestätigen'}
                        </button>

                        ${o.status === 'bestellt' ? `
                            <button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" 
                                style="${o.paid ? 'background-color:#22c55e; color:black; border-color:#22c55e;' : 'background-color:transparent; color:#ef4444; border-color:#ef4444;'} width:100%;">
                                ${o.paid ? 'Bezahlt' : 'Nicht bezahlt'}
                            </button>
                        ` : ''}

                        <button class="btn btn-secondary btn-sm archive-order-btn" data-id="${o.id}" style="width:100%; margin-top:5px;">Archivieren</button>
                    </div>
                 `;
            }

            return `
            <div class="order-card" style="opacity:${cardOpacity}; background:${cardBg}; border:1px solid var(--glass-border); border-radius:8px; padding:10px; margin-bottom:10px; display:flex;">
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between;">
                        <div><b>${o.id}</b> <span style="color:#888">(${o.user})</span> <span class="status-badge status-${o.status}">${o.status}</span></div>
                        <div style="font-weight:bold;">${total}</div>
                    </div>
                    <div style="font-size:0.8em; color:#888; margin:2px 0 8px 0;">${dateStr}</div>
                    <div style="font-size:0.9em; color:#ccc;">${itemsHtml}</div>
                    
                    ${(!isArchive && !isCancelled) ? `
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                        <textarea class="form-control admin-note-input" data-id="${o.id}" rows="3" placeholder="Admin Notiz..." style="width:100%; margin-bottom:8px; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); color:white; resize:none; padding:8px; border-radius:4px;">${o.adminNote || ''}</textarea>
                        <button class="btn btn-secondary btn-sm save-note-btn" data-id="${o.id}" style="width:100%">Notiz Speichern</button>
                    </div>` : ''}

                    ${isCancelled ? `<div style="margin-top:10px; font-style:italic; color:#ef4444;">Bestellung wurde vom Nutzer storniert.</div>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; min-width:140px;">${btns}</div>
            </div>`;
        };

        const activeHtml = displayOrders.length ? displayOrders.map(o => renderOrderCard(o, false)).join('') : '<p style="color:#888; padding:10px;">Keine aktiven Bestellungen.</p>';
        const mainDiv = document.createElement('div');
        mainDiv.innerHTML = activeHtml;
        content.appendChild(mainDiv);

        if (archivedOrders.length > 0) {
            const archDiv = document.createElement('div');
            // MATCHING PROFILE LOGIC EXACTLY
            archDiv.innerHTML = `
                <details id="admin-archive-details" style="margin-top:40px; background:rgba(255,255,255,0.02); border-radius:8px; overflow:hidden;" ${isArchiveOpen ? 'open' : ''}>
                    <summary style="padding:15px; cursor:pointer; font-weight:bold; background:rgba(255,255,255,0.05); color:var(--text-color);">Archiv (${archivedOrders.length})</summary>
                    <div class="archive-list" style="padding:15px; display:grid; gap:15px;">
                        ${archivedOrders.map(o => renderOrderCard(o, true)).join('')}
                    </div>
                </details>
            `;
            content.appendChild(archDiv);

            // Persistence Listener Only (No Manual Arrow Logic)
            setTimeout(() => {
                const det = content.querySelector('#admin-archive-details');
                if (det) det.ontoggle = () => list.dataset.archiveOpen = det.open;
            }, 0);
        }

        // --- Event Delegation ---
        list.onclick = async (e) => {
            const t = e.target;
            const id = t.dataset.id;
            // if (t.closest('summary')) return; // Summary handles toggle natively

            const reload = () => selfRender(elements, DB, showConfirm, selfRender, cartHelper);

            if (t.classList.contains('archive-order-btn')) { await DB.updateOrder(id, o => o.adminArchived = true); reload(); }
            if (t.classList.contains('unarchive-order')) { await DB.updateOrder(id, o => o.adminArchived = false); reload(); }
            if (t.classList.contains('delete-permanent')) {
                showConfirm('Endgültig Löschen?', 'Diese Bestellung wird komplett aus der Datenbank entfernt.', async () => {
                    await DB.deleteOrder(id);
                    reload();
                });
            }

            if (t.classList.contains('reject-order')) {
                const newStatus = t.dataset.status === 'abgelehnt' ? 'open' : 'abgelehnt';
                await DB.updateOrder(id, o => o.status = newStatus);
                reload();
            }
            if (t.classList.contains('confirm-order')) {
                const newStatus = t.dataset.status === 'bestellt' ? 'open' : 'bestellt';
                await DB.updateOrder(id, o => o.status = newStatus);
                reload();
            }
            if (t.classList.contains('toggle-paid')) {
                await DB.updateOrder(id, o => o.paid = !o.paid);
                reload();
            }
            if (t.classList.contains('save-note-btn')) {
                const val = list.querySelector(`.admin-note-input[data-id="${id}"]`).value;
                await DB.updateOrder(id, o => o.adminNote = val);
                CoreUI.showModal('Gespeichert', 'OK');
            }
        };

        // ... (User handlers same as before) ...
    },
    setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal, cartHelper) {
        // ... (Logic for users tab, unchanged from previous read, just ensuring it's kept in rewriting) ...
        // Since I am rewriting the file, I must include this method.
        // Copied from Step 618 output.
        // ...
        const createBtn = content.querySelector('#create-user-btn');
        if (createBtn) createBtn.onclick = async () => {
            const u = content.querySelector('#new-user-name').value.trim();
            const p = content.querySelector('#new-user-pass').value.trim();
            if (u && p) {
                try { await DB.createUser(u, p); selfRender(elements, DB, showConfirm, selfRender, cartHelper); }
                catch (e) { CoreUI.showModal('Fehler', e.message); }
            }
        };

        content.querySelectorAll('.manage-role-btn').forEach(b => {
            b.onclick = () => content.querySelector(`#role-accordion-${b.dataset.user}`).classList.toggle('hidden');
        });

        const safeRoleHandler = (e, type) => {
            e.preventDefault();
            e.stopPropagation();

            const chk = e.target;
            const username = chk.dataset.user;
            const currentState = chk.checked;
            const intendedState = !currentState;

            const label = type === 'admin' ? 'Administrator' : 'Pablo Flatrate';
            const action = intendedState ? 'geben' : 'entziehen';

            showAdminModal('Rolle ändern', `Soll <strong>${username}</strong> ${label} ${action}?`, async () => {
                const updates = {};
                if (type === 'admin') updates.role = intendedState ? 'admin' : 'user';
                if (type === 'pablo') updates.isPablo = intendedState;

                try {
                    await DB.updateUser(username, updates);
                    setTimeout(() => selfRender(elements, DB, showConfirm, selfRender, cartHelper), 50);
                } catch (e) {
                    CoreUI.showModal('Fehler', 'Speichern fehlgeschlagen.');
                }
            });
        };

        content.querySelectorAll('.role-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'admin'));
        content.querySelectorAll('.pablo-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'pablo'));

        content.querySelectorAll('.delete-user').forEach(b => b.onclick = () => {
            const u = b.dataset.user;
            showConfirm('Löschen?', u, async () => { await DB.deleteUser(u); selfRender(elements, DB, showConfirm, selfRender, cartHelper); });
        });
        content.querySelectorAll('.edit-pw-btn').forEach(b => b.onclick = () => {
            const u = b.dataset.user;
            showAdminModal('Passwort Ändern',
                '<div style="display:flex; flex-direction:column; gap:10px;">' +
                '<input id="pw1" type="password" placeholder="Neues Passwort" class="form-input" style="padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:rgba(0,0,0,0.5); color:white; width:100%;">' +
                '<input id="pw2" type="password" placeholder="Passwort Bestätigen" class="form-input" style="padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:rgba(0,0,0,0.5); color:white; width:100%;">' +
                '</div>', async (m) => {
                    const p1 = m.querySelector('#pw1').value;
                    const p2 = m.querySelector('#pw2').value;
                    if (p1 && p1 === p2) {
                        await DB.updateUser(u, { password: p1 });
                        CoreUI.showModal('Erfolg', 'Passwort wurde geändert.');
                        selfRender(elements, DB, showConfirm, selfRender, cartHelper);
                    } else if (p1 !== p2) {
                        CoreUI.showModal('Fehler', 'Passwörter stimmen nicht überein.');
                    }
                });
        });

        // FIX: Add Handler for "Bestellungen" (Filter Orders) button
        content.querySelectorAll('.view-user-orders').forEach(b => {
            b.onclick = () => {
                const list = elements.ordersList;
                list.dataset.selectedUser = b.dataset.user;
                list.dataset.activeTab = 'orders';
                // Dispatch event for Main UI updates (Nav highlight)
                window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: 'orders' } }));
                // Trigger re-render
                selfRender(elements, DB, showConfirm, selfRender, cartHelper);
            };
        });
    }
};

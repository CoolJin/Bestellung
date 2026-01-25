// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender) {
        const list = elements.ordersList;
        if (!list) return;

        // --- Tab Navigation controlled by Top Nav ---
        let activeTab = list.dataset.activeTab || 'orders';
        let selectedUserFilter = list.dataset.selectedUser || null;

        // Capture Open State
        const isArchiveOpen = list.dataset.archiveOpen === 'true';

        // Clear list
        list.innerHTML = '';
        const content = document.createElement('div');
        list.appendChild(content);

        // --- Helper for Modals ---
        const showAdminModal = (title, contentHTML, onConfirm) => {
            const modalId = 'admin-dynamic-modal';
            let modal = document.getElementById(modalId);
            if (modal) modal.remove();

            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content glass-panel">
                    <h3>${title}</h3>
                    <div style="margin:15px 0;">${contentHTML}</div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary close-modal">Abbrechen</button>
                        <button class="btn btn-primary confirm-modal">Bestätigen</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const close = () => modal.remove();
            modal.querySelector('.close-modal').onclick = close;
            modal.querySelector('.confirm-modal').onclick = () => {
                onConfirm(modal);
                close();
            };
        };

        // --- USERS TAB ---
        if (activeTab === 'users') {
            const users = DB.getUsers();
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
                        ${users.map(u => {
                const showOrdersBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-secondary view-user-orders" data-user="${u.username}">Bestellungen</button>` : '';
                const showDeleteBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : '';

                return `
                <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold;">
                                ${u.username} 
                                <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span>
                                ${u.isPablo ? '<span style="font-size:0.8em; color:var(--primary-color); margin-left:5px;">(Pablo-Flat)</span>' : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            ${showOrdersBtn}
                            <button class="btn btn-sm btn-secondary edit-pw-btn" data-user="${u.username}">Passwort ändern</button>
                            <button class="btn btn-sm btn-secondary manage-role-btn" data-user="${u.username}">Rollen</button>
                            ${showDeleteBtn}
                        </div>
                    </div>
                    <!-- Role Accordion -->
                    <div class="role-accordion hidden" id="role-accordion-${u.username}" style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; animate: fadeIn 0.2s;">
                         <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:8px;">
                            <input type="checkbox" class="role-checkbox" data-role="admin" data-user="${u.username}" ${u.role === 'admin' ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span style="color:white;">Administrator</span>
                        </label>
                        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" class="pablo-checkbox" data-user="${u.username}" ${u.isPablo ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span style="color:white;">Pablo Flatrate</span>
                        </label>
                    </div>
                </div>`;
            }).join('')}
                    </div>
                </div>
            `;
            this.setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal);
            return;
        }

        // --- ORDERS TAB ---
        let allOrders = DB.getOrders()
            .filter(o => !o.deletedByAdmin)
            .sort((a, b) => b.id.localeCompare(a.id));

        const activeOrders = allOrders.filter(o => !o.adminArchived);
        const archivedOrders = allOrders.filter(o => o.adminArchived);

        let displayOrders = activeOrders;
        if (selectedUserFilter && selectedUserFilter !== 'null' && selectedUserFilter !== '') {
            displayOrders = displayOrders.filter(o => o.user === selectedUserFilter);
            content.innerHTML += `
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(56, 189, 248, 0.1); padding:10px; border-radius:8px; border:1px solid var(--primary-color);">
                    <span>Filter: <strong>${selectedUserFilter}</strong> (${displayOrders.length} Treffer)</span>
                    <button class="btn btn-sm btn-secondary" id="clear-filter-btn">Filter löschen</button>
                </div>
            `;
            setTimeout(() => {
                const cfBtn = content.querySelector('#clear-filter-btn');
                if (cfBtn) cfBtn.onclick = () => {
                    list.dataset.selectedUser = '';
                    selfRender(elements, DB, showConfirm, selfRender);
                    return;
                };
            }, 0);
        }

        const renderOrderCard = (o, isArchiveView) => {
            let displayTotal = o.total;
            if (!displayTotal || displayTotal === '0' || displayTotal === '0,00 €') {
                let sum = (o.items || []).reduce((acc, i) => {
                    let price = parseFloat((i.price || '0').toString().replace('€', '').replace(',', '.').trim()) || 0;
                    return acc + (price * (i.quantity || 1));
                }, 0);
                displayTotal = sum.toFixed(2).replace('.', ',') + ' €';
            }

            const rejectStyle = o.status === 'abgelehnt' ? 'background: #ef4444; color: white; border:1px solid #ef4444' : 'background: transparent; color: #ef4444; border: 1px solid #ef4444';
            const confirmStyle = o.status === 'bestellt' ? 'background: var(--primary-color); color: #0f172a; border:1px solid var(--primary-color)' : 'background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color)';

            let paidButton = '';
            if (o.status === 'bestellt' && !isArchiveView) {
                const paidColor = o.paid ? '#22c55e' : '#ef4444';
                const paidText = o.paid ? 'Bezahlt' : 'Nicht bezahlt';
                paidButton = `<button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" style="margin-top:5px; border-color: ${paidColor}; color: ${paidColor}">${paidText}</button>`;
            }

            let actionButtons = isArchiveView ? `
                    <button class="btn btn-secondary btn-sm unarchive-order" data-id="${o.id}">Wiederherstellen</button>
                    <button class="btn btn-danger btn-sm delete-permanent" data-id="${o.id}">Löschen</button>
                 ` : `
                    <button class="btn btn-sm reject-order" data-id="${o.id}" data-status="${o.status}" style="${rejectStyle}">Ablehnen</button>
                    <button class="btn btn-sm confirm-order" data-id="${o.id}" data-status="${o.status}" style="${confirmStyle}">Bestellt</button>
                    ${paidButton}
                    <button class="btn btn-secondary btn-sm archive-order-btn" data-id="${o.id}" style="margin-top:5px; width:100%;">Archivieren</button>
                 `;

            const itemsHtml = (o.items || []).map(i => {
                let unitPrice = parseFloat((i.price || '0').toString().replace('€', '').replace(',', '.').trim()) || 0;
                const lineSum = unitPrice * (i.quantity || 1);
                return `
                   <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
                        <div style="display:flex; gap: 15px;">
                            <span>${i.quantity}x ${i.name}</span>
                        </div>
                        <span>${lineSum.toFixed(2).replace('.', ',')} €</span>
                   </div>`;
            }).join('');

            return `
            <div class="order-card" style="opacity: ${isArchiveView ? '0.7' : '1'}; background: ${isArchiveView ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.03)'};">
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <b>${o.id}</b> <span class="text-muted">(${o.user})</span>
                            <span class="status-badge status-${o.status}" style="margin-left:8px">${o.status}</span>
                        </div>
                        <div style="font-weight:600;">${displayTotal}</div>
                    </div>
                    
                    <div style="font-size:0.85rem; margin-top:5px; color:var(--text-muted);">
                       ${itemsHtml}
                    </div>

                    ${!isArchiveView ? `
                    <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                        <label style="font-size:0.85em; color:var(--text-muted); display:block; margin-bottom:5px;">Admin Notiz:</label>
                        <textarea class="form-control admin-note-input" data-id="${o.id}" rows="2" placeholder="Notiz..." 
                            style="resize: none; background: rgba(0,0,0,0.3); color: var(--text-color); border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px; width: 100%; font-family: inherit; font-size: 0.9em; min-height: 60px;">${o.adminNote || ''}</textarea>
                        <button class="btn btn-secondary btn-sm save-note-btn" data-id="${o.id}" style="margin-top:8px; width:100%; justify-content:center;">Speichern</button>
                    </div>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; min-width: 140px;">
                    ${actionButtons}
                </div>
            </div>`;
        };

        const activeHtml = displayOrders.length > 0 ? displayOrders.map(o => renderOrderCard(o, false)).join('') : '<p style="color:var(--text-muted); font-style:italic;">Keine aktiven Bestellungen.</p>';
        const mainOrdersDiv = document.createElement('div');
        mainOrdersDiv.innerHTML = activeHtml;
        content.appendChild(mainOrdersDiv);

        // --- Archive Section ---
        if (archivedOrders.length > 0) {
            const archiveSection = document.createElement('div');
            archiveSection.className = `admin-archive-section`;
            archiveSection.style.marginTop = '40px';
            archiveSection.style.borderTop = '1px solid var(--glass-border)';

            const header = document.createElement('div');
            header.className = 'archive-header';
            header.style.cssText = `
                padding: 15px; 
                cursor: pointer; 
                display: flex; 
                justify-content: space-between; 
                align-items: center;
                background: rgba(255,255,255,0.03);
                border-radius: 8px;
                margin-top: 15px;
                transition: background 0.2s;
            `;
            header.onmouseover = () => header.style.background = 'rgba(255,255,255,0.06)';
            header.onmouseout = () => header.style.background = 'rgba(255,255,255,0.03)';
            header.innerHTML = `
                <span style="font-weight:600; color:var(--text-color);">Archivierte Bestellungen (${archivedOrders.length})</span>
                <span style="transform: ${isArchiveOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.3s;">▼</span>
            `;

            const body = document.createElement('div');
            body.className = 'archive-list';
            body.style.display = isArchiveOpen ? 'grid' : 'none';
            body.style.gap = '10px';
            body.style.marginTop = '15px';
            body.innerHTML = archivedOrders.map(o => renderOrderCard(o, true)).join('');

            header.onclick = () => {
                const nowOpen = body.style.display === 'none';
                body.style.display = nowOpen ? 'grid' : 'none';
                list.dataset.archiveOpen = nowOpen;
                header.querySelector('span:last-child').style.transform = nowOpen ? 'rotate(180deg)' : 'rotate(0deg)';
                selfRender(elements, DB, showConfirm, selfRender);
            };

            archiveSection.appendChild(header);
            archiveSection.appendChild(body);
            content.appendChild(archiveSection);
        }

        // Delegate (Async) Actions
        list.onclick = async (e) => {
            const trg = e.target;
            const id = trg.dataset.id;
            if (!id) return;

            if (trg.classList.contains('archive-order-btn')) {
                await DB.updateOrder(id, o => o.adminArchived = true);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (trg.classList.contains('unarchive-order')) {
                await DB.updateOrder(id, o => o.adminArchived = false);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (trg.classList.contains('delete-permanent')) {
                showConfirm('Bestellung löschen?', 'Wollen Sie diese Bestellung endgültig löschen? (Kann nicht rückgängig gemacht werden).', async () => {
                    await DB.deleteOrder(id);
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            }
            if (trg.classList.contains('reject-order')) {
                const currentStatus = trg.dataset.status;
                const newStatus = currentStatus === 'abgelehnt' ? 'open' : 'abgelehnt';
                await DB.updateOrder(id, o => o.status = newStatus);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (trg.classList.contains('confirm-order')) {
                const currentStatus = trg.dataset.status;
                const newStatus = currentStatus === 'bestellt' ? 'open' : 'bestellt';
                await DB.updateOrder(id, o => o.status = newStatus);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (trg.classList.contains('toggle-paid')) {
                await DB.updateOrder(id, o => o.paid = !o.paid);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (trg.classList.contains('save-note-btn')) {
                const noteInput = list.querySelector(`.admin-note-input[data-id="${id}"]`);
                if (noteInput) {
                    await DB.updateOrder(id, o => o.adminNote = noteInput.value);
                    CoreUI.showModal('Gespeichert', 'Notiz wurde aktualisiert.');
                }
            }
        };
    },

    setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal) {
        content.querySelector('#create-user-btn').onclick = async () => {
            const nameIn = content.querySelector('#new-user-name');
            const passIn = content.querySelector('#new-user-pass');
            if (!nameIn || !passIn) return;
            const username = nameIn.value.trim();
            const password = passIn.value.trim();
            if (!username || !password) return CoreUI.showModal('Fehler', 'Bitte Name und Passwort eingeben');
            try {
                await DB.createUser(username, password);
                selfRender(elements, DB, showConfirm, selfRender);
            } catch (e) {
                CoreUI.showModal('Fehler', e.message);
            }
        };
        content.querySelectorAll('.delete-user').forEach(btn => {
            btn.onclick = () => {
                const u = btn.dataset.user;
                showConfirm('Benutzer löschen?', `Benutzer "${u}" wirklich löschen?`, async () => {
                    await DB.deleteUser(u);
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            };
        });
        content.querySelectorAll('.view-user-orders').forEach(btn => {
            btn.onclick = () => {
                const list = elements.ordersList;
                if (list) {
                    list.dataset.activeTab = 'orders';
                    list.dataset.selectedUser = btn.dataset.user;
                    window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: 'orders' } }));
                    selfRender(elements, DB, showConfirm, selfRender);
                }
            };
        });
        content.querySelectorAll('.manage-role-btn').forEach(btn => {
            btn.onclick = () => {
                const accordion = content.querySelector(`#role-accordion-${btn.dataset.user}`);
                if (accordion) {
                    const isHidden = accordion.classList.contains('hidden');
                    accordion.classList.toggle('hidden');
                    if (isHidden) {
                        btn.classList.remove('btn-secondary');
                        btn.classList.add('btn-primary');
                    } else {
                        btn.classList.add('btn-secondary');
                        btn.classList.remove('btn-primary');
                    }
                }
            };
        });

        // --- CHECKBOX LOGIC (Updated to handle both Admin and Pablo) ---
        const handleRoleChange = (e, roleType) => {
            const isChecked = e.target.checked;
            const username = e.target.dataset.user;
            e.target.checked = !isChecked; // Revert via UI first (wait for confirm)

            const label = roleType === 'admin' ? 'Administrator' : 'Pablo Flatrate';
            const action = isChecked ? 'geben' : 'entziehen';

            showAdminModal('Rolle ändern?', `Möchten Sie dem Benutzer <strong>${username}</strong> die Rolle "${label}" ${action}?`, async (modal) => {
                const updates = {};
                if (roleType === 'admin') updates.role = isChecked ? 'admin' : 'user';
                if (roleType === 'pablo') updates.isPablo = isChecked;

                await DB.updateUser(username, updates);
                selfRender(elements, DB, showConfirm, selfRender);
            });
        };

        content.querySelectorAll('.role-checkbox').forEach(chk => {
            chk.onchange = (e) => handleRoleChange(e, 'admin');
        });
        content.querySelectorAll('.pablo-checkbox').forEach(chk => {
            chk.onchange = (e) => handleRoleChange(e, 'pablo');
        });

        content.querySelectorAll('.edit-pw-btn').forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.user;
                showAdminModal('Passwort ändern', `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <input type="text" id="modal-pw-1" placeholder="Neues Passwort" style="width:100%;">
                        <input type="text" id="modal-pw-2" placeholder="Passwort bestätigen" style="width:100%;">
                    </div>
                `, async (modal) => {
                    const p1 = modal.querySelector('#modal-pw-1').value.trim();
                    const p2 = modal.querySelector('#modal-pw-2').value.trim();
                    if (p1 && p1 === p2) {
                        await DB.updateUser(username, { password: p1 });
                        selfRender(elements, DB, showConfirm, selfRender);
                    } else {
                        CoreUI.showModal('Fehler', 'Passwörter stimmen nicht überein oder sind leer.');
                    }
                });
            };
        });
    }
};

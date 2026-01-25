// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';
import { OrdersUI } from './orders.js'; // Use OrdersUI for helpers if needed

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender) {
        const list = elements.ordersList;
        if (!list) return;

        // --- Tab Navigation controlled by Top Nav ---
        let activeTab = list.dataset.activeTab || 'orders';
        let selectedUserFilter = list.dataset.selectedUser || null;

        // Capture Open Accordions (State Persistence)
        const openAccordions = [];
        list.querySelectorAll('.role-accordion:not(.hidden)').forEach(acc => {
            openAccordions.push(acc.id);
        });
        const isArchiveOpen = list.querySelector('.admin-archive-section.open') !== null;

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

            const renderUserCard = (u) => {
                const isOpen = openAccordions.includes(`role-accordion-${u.username}`);
                const roleBtnClass = isOpen ? 'btn-primary' : 'btn-secondary';
                const showOrdersBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-secondary view-user-orders" data-user="${u.username}">Bestellungen</button>` : '';
                const showDeleteBtn = u.role !== 'admin' ?
                    `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : '';

                return `
                <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold;">${u.username} <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span></div>
                            <div style="font-size:0.9em; color:#aaa;">Passwort: ${u.password}</div>
                        </div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            ${showOrdersBtn}
                            <button class="btn btn-sm ${roleBtnClass} manage-role-btn" data-user="${u.username}">Rollen verwalten</button>
                            <button class="btn btn-sm btn-secondary edit-pw-btn" data-user="${u.username}">Passwort bearbeiten</button>
                            ${showDeleteBtn}
                        </div>
                    </div>
                    
                    <div class="role-accordion ${isOpen ? '' : 'hidden'}" id="role-accordion-${u.username}" style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border-left: 3px solid var(--primary-color);">
                        <div style="margin-bottom:8px; color:var(--text-muted); font-size:0.9em;">Rollen zuweisen:</div>
                        <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:15px; cursor:pointer; padding: 5px 5px 5px 35px;">
                            <input type="checkbox" class="role-checkbox" data-role="admin" data-user="${u.username}" ${u.role === 'admin' ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            <span style="color:white; font-size:1rem;">Administrator</span>
                        </label>
                    </div>
                </div>`;
            };

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
                        ${users.map(u => renderUserCard(u)).join('')}
                    </div>
                </div>
            `;
            this.setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal);
            return;
        }

        // --- ORDERS TAB ---
        let allOrders = DB.getOrders()
            .filter(o => !o.deletedByAdmin) // Filter out "Hard Deleted" (if any)
            .sort((a, b) => b.id.localeCompare(a.id));

        // Filter: Active (Not Admin Archived) vs Archived
        const activeOrders = allOrders.filter(o => !o.adminArchived);
        const archivedOrders = allOrders.filter(o => o.adminArchived);

        let displayOrders = activeOrders;

        if (selectedUserFilter && selectedUserFilter !== 'null' && selectedUserFilter !== '') {
            displayOrders = displayOrders.filter(o => o.user === selectedUserFilter);
            content.innerHTML += `
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(56, 189, 248, 0.1); padding:10px; border-radius:8px; border:1px solid var(--primary-color);">
                    <span>Filter: <strong>${selectedUserFilter}</strong> (${displayOrders.length} Bestellungen)</span>
                    <button class="btn btn-sm btn-secondary" id="clear-filter-btn">Filter löschen</button>
                </div>
            `;
            setTimeout(() => {
                const cfBtn = content.querySelector('#clear-filter-btn');
                if (cfBtn) cfBtn.onclick = () => {
                    list.dataset.selectedUser = '';
                    selfRender(elements, DB, showConfirm, selfRender);
                };
            }, 0);
        }

        const renderOrderCard = (o, isArchiveView) => {
            // ... Logic copied from OrdersUI or inline ...
            // Formatting
            let displayTotal = o.total;
            if (!displayTotal || displayTotal === '0' || displayTotal === '0,00 €') {
                let sum = (o.items || []).reduce((acc, i) => {
                    let price = parseFloat((i.price || '0').toString().replace('€', '').replace(',', '.').trim()) || 0;
                    return acc + (price * (i.quantity || 1));
                }, 0);
                displayTotal = sum.toFixed(2).replace('.', ',') + ' €';
            }

            // Buttons
            const rejectStyle = o.status === 'abgelehnt' ? 'background: #ef4444; color: white; border:1px solid #ef4444' : 'background: transparent; color: #ef4444; border: 1px solid #ef4444';
            const confirmStyle = o.status === 'bestellt' ? 'background: var(--primary-color); color: #0f172a; border:1px solid var(--primary-color)' : 'background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color)';

            let paidButton = '';
            if (o.status === 'bestellt' && !isArchiveView) {
                const paidColor = o.paid ? '#22c55e' : '#ef4444';
                const paidText = o.paid ? 'Bezahlt' : 'Nicht bezahlt';
                paidButton = `<button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" style="margin-top:5px; border-color: ${paidColor}; color: ${paidColor}">${paidText}</button>`;
            }

            let actionButtons = '';
            if (isArchiveView) {
                actionButtons = `
                    <button class="btn btn-secondary btn-sm unarchive-order" data-id="${o.id}">Wiederherstellen</button>
                    <button class="btn btn-danger btn-sm delete-permanent" data-id="${o.id}">Endgültig Löschen</button>
                 `;
            } else {
                actionButtons = `
                    <button class="btn btn-sm reject-order" data-id="${o.id}" data-status="${o.status}" style="${rejectStyle}">Ablehnen</button>
                    <button class="btn btn-sm confirm-order" data-id="${o.id}" data-status="${o.status}" style="${confirmStyle}">Bestellt</button>
                    ${paidButton}
                    <button class="btn btn-secondary btn-sm archive-order-btn" data-id="${o.id}" style="margin-top:5px; width:100%;">Archivieren</button>
                 `;
            }

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
            <div class="order-card" style="opacity: ${isArchiveView ? '0.7' : '1'}">
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
                        <textarea class="form-control admin-note-input" data-id="${o.id}" rows="2" placeholder="Notiz für Kunden..." 
                            style="resize: none; background: rgba(0,0,0,0.3); color: var(--text-color); border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px; width: 100%; font-family: inherit; font-size: 0.9em; min-height: 60px;">${o.adminNote || ''}</textarea>
                        <button class="btn btn-secondary btn-sm save-note-btn" data-id="${o.id}" style="margin-top:8px; width:100%; justify-content:center;">Notiz Speichern</button>
                    </div>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; min-width: 140px;">
                    ${actionButtons}
                </div>
            </div>`;
        };

        const activeHtml = displayOrders.length > 0 ? displayOrders.map(o => renderOrderCard(o, false)).join('') : '<p>Keine aktiven Bestellungen.</p>';
        const mainOrdersDiv = document.createElement('div');
        mainOrdersDiv.innerHTML = activeHtml;
        content.appendChild(mainOrdersDiv);

        // --- Archive Section ---
        if (archivedOrders.length > 0) {
            const archiveSection = document.createElement('div');
            archiveSection.className = `admin-archive-section ${isArchiveOpen ? 'open' : ''}`;
            archiveSection.style.marginTop = '30px';
            archiveSection.style.borderTop = '1px solid var(--glass-border)';

            archiveSection.innerHTML = `
                <div class="archive-header" style="padding:15px 0; cursor:pointer; display:flex; justify-content:space-between; color:var(--text-muted);">
                    <span>Archivierte Bestellungen (${archivedOrders.length})</span>
                    <span>▼</span>
                </div>
                <div class="archive-list ${isArchiveOpen ? 'open' : ''}" style="display:${isArchiveOpen ? 'block' : 'none'};">
                    ${archivedOrders.map(o => renderOrderCard(o, true)).join('')}
                </div>
            `;
            content.appendChild(archiveSection);

            // Toggle Handler
            const header = archiveSection.querySelector('.archive-header');
            const body = archiveSection.querySelector('.archive-list');
            header.onclick = () => {
                const isOpen = body.style.display === 'block';
                body.style.display = isOpen ? 'none' : 'block';
                if (isOpen) archiveSection.classList.remove('open');
                else archiveSection.classList.add('open');
            };
        }

        // Delegate (Async) Actions
        list.onclick = async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            // Prevent event bubbling from Archive Header
            if (e.target.closest('.archive-header')) return;

            if (e.target.classList.contains('archive-order-btn')) {
                await DB.updateOrder(id, o => o.adminArchived = true);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (e.target.classList.contains('unarchive-order')) {
                await DB.updateOrder(id, o => o.adminArchived = false);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (e.target.classList.contains('delete-permanent')) {
                showConfirm('Bestellung löschen?', 'Wollen Sie diese Bestellung endgültig löschen? (Kann nicht rückgängig gemacht werden).', async () => {
                    await DB.deleteOrder(id);
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            }

            // Existing Actions
            if (e.target.classList.contains('reject-order')) {
                const currentStatus = e.target.dataset.status;
                const newStatus = currentStatus === 'abgelehnt' ? 'open' : 'abgelehnt';
                await DB.updateOrder(id, o => o.status = newStatus);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (e.target.classList.contains('confirm-order')) {
                const currentStatus = e.target.dataset.status;
                const newStatus = currentStatus === 'bestellt' ? 'open' : 'bestellt';
                await DB.updateOrder(id, o => o.status = newStatus);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (e.target.classList.contains('toggle-paid')) {
                await DB.updateOrder(id, o => o.paid = !o.paid);
                selfRender(elements, DB, showConfirm, selfRender);
            }
            if (e.target.classList.contains('save-note-btn')) {
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
        content.querySelectorAll('.role-checkbox').forEach(chk => {
            chk.onchange = (e) => {
                const isChecked = e.target.checked;
                const username = e.target.dataset.user;
                e.target.checked = !isChecked; // Revert
                showAdminModal('Rolle ändern?', `Möchten Sie dem Benutzer <strong>${username}</strong> die Administrator-Rechte ${isChecked ? 'geben' : 'entziehen'}?`, async (modal) => {
                    await DB.updateUser(username, { role: isChecked ? 'admin' : 'user' });
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            };
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

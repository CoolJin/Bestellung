// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender) {
        const list = elements.ordersList;
        if (!list) return;

        // --- Tab Navigation controlled by Top Nav ---
        let activeTab = list.dataset.activeTab || 'orders';
        let selectedUserFilter = list.dataset.selectedUser || null;

        // Capture Open Accordions (State Persistence within Session)
        const openAccordions = [];
        list.querySelectorAll('.role-accordion').forEach(acc => {
            if (!acc.classList.contains('hidden')) {
                // Extract username from id "role-accordion-USERNAME"
                const username = acc.id.replace('role-accordion-', '');
                openAccordions.push(username);
            }
        });

        // Clear list to render fresh content
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
                        ${DB.getUsers().map(u => {
                const isOpen = openAccordions.includes(u.username);
                return `
                            <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:bold;">${u.username} <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span></div>
                                        <div style="font-size:0.9em; color:#aaa;">Passwort: ${u.password}</div>
                                    </div>
                                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                                        ${u.role !== 'admin' ? `<button class="btn btn-sm btn-secondary view-user-orders" data-user="${u.username}">Bestellungen</button>` : ''}
                                        <button class="btn btn-sm ${isOpen ? 'btn-primary' : 'btn-secondary'} manage-role-btn" data-user="${u.username}">Rollen verwalten</button>
                                        <button class="btn btn-sm btn-secondary edit-pw-btn" data-user="${u.username}">Passwort bearbeiten</button>
                                        ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : ''}
                                    </div>
                                </div>
                                
                                <!-- Accordion for Roles -->
                                <div class="role-accordion ${isOpen ? '' : 'hidden'}" id="role-accordion-${u.username}" style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border-left: 3px solid var(--primary-color);">
                                    <div style="margin-bottom:8px; color:var(--text-muted); font-size:0.9em;">Rollen zuweisen:</div>
                                    <label class="custom-checkbox-label" style="display:flex; align-items:center; gap:15px; cursor:pointer; padding: 5px 5px 5px 35px;">
                                        <input type="checkbox" class="role-checkbox" data-role="admin" data-user="${u.username}" ${u.role === 'admin' ? 'checked' : ''}>
                                        <span class="checkmark"></span>
                                        <span style="color:white; font-size:1rem;">Administrator</span>
                                    </label>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;

            // Handlers (Create/Delete/View) - Now Async
            content.querySelector('#create-user-btn').onclick = async () => {
                const nameIn = content.querySelector('#new-user-name');
                const passIn = content.querySelector('#new-user-pass');
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
                    list.dataset.activeTab = 'orders';
                    list.dataset.selectedUser = btn.dataset.user;
                    // Trigger custom event to update Top Nav
                    window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: 'orders' } }));
                    selfRender(elements, DB, showConfirm, selfRender);
                };
            });

            // New Handlers for Role (Accordion + Modal Confirm)
            content.querySelectorAll('.manage-role-btn').forEach(btn => {
                btn.onclick = () => {
                    const accordion = content.querySelector(`#role-accordion-${btn.dataset.user}`);
                    const isHidden = accordion.classList.contains('hidden');

                    // Toggle Visibility
                    accordion.classList.toggle('hidden');

                    // Toggle Button Style (Secondary (Outline-ish) <-> Primary (Filled))
                    if (isHidden) {
                        btn.classList.remove('btn-secondary');
                        btn.classList.add('btn-primary');
                    } else {
                        btn.classList.add('btn-secondary');
                        btn.classList.remove('btn-primary');
                    }
                };
            });

            content.querySelectorAll('.role-checkbox').forEach(chk => {
                chk.onchange = (e) => {
                    const isChecked = e.target.checked;
                    const username = e.target.dataset.user;
                    // Revert immediately to wait for confirmation
                    e.target.checked = !isChecked;

                    showAdminModal('Rolle ändern?', `
                        Möchten Sie dem Benutzer <strong>${username}</strong> die Administrator-Rechte ${isChecked ? 'geben' : 'entziehen'}?
                    `, async (modal) => {
                        await DB.updateUser(username, { role: isChecked ? 'admin' : 'user' });
                        selfRender(elements, DB, showConfirm, selfRender);
                    });
                };
            });

            // Password Modal
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
            return;
        }

        // --- ORDERS TAB ---
        let orders = DB.getOrders()
            .filter(o => !o.deletedByAdmin)
            .sort((a, b) => b.id.localeCompare(a.id));

        if (selectedUserFilter && selectedUserFilter !== 'null' && selectedUserFilter !== '') {
            orders = orders.filter(o => o.user === selectedUserFilter);

            // Render Filter Banner
            content.innerHTML += `
                <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(56, 189, 248, 0.1); padding:10px; border-radius:8px; border:1px solid var(--primary-color);">
                    <span>Filter: <strong>${selectedUserFilter}</strong> (${orders.length} Bestellungen)</span>
                    <button class="btn btn-sm btn-secondary" id="clear-filter-btn">Filter löschen</button>
                </div>
            `;
            // Must attach event after rendering
            setTimeout(() => {
                const cfBtn = content.querySelector('#clear-filter-btn');
                if (cfBtn) cfBtn.onclick = () => {
                    list.dataset.selectedUser = '';
                    selfRender(elements, DB, showConfirm, selfRender);
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

        // Event Delegator for Admin Actions (Orders) - Handlers
        list.onclick = async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;

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
    }
};

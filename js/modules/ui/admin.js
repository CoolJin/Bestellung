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
        const openAccordions = new Set();
        list.querySelectorAll('.role-accordion:not(.hidden)').forEach(acc => {
            openAccordions.add(acc.id);
        });
        const isArchiveOpen = list.dataset.archiveOpen === 'true';

        // Clear list
        list.innerHTML = '';
        const content = document.createElement('div');
        list.appendChild(content);

        const showAdminModal = (title, contentHTML, onConfirm) => {
            const modalId = 'admin-dynamic-modal';
            let modal = document.getElementById(modalId);
            if (modal) modal.remove();

            // Create Modal Wrapper
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            modal.style.zIndex = '10000'; // Ensure high z-index
            modal.innerHTML = `
                <div class="modal-content glass-panel" style="position:relative; z-index:10001;">
                    <h3>${title}</h3>
                    <div style="margin:15px 0;">${contentHTML}</div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary close-modal">Abbrechen</button>
                        <button class="btn btn-primary confirm-modal">Bestätigen</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const close = () => {
                modal.remove();
                // selfRender(elements, DB, showConfirm, selfRender); // Restore UI state in case it was glitchy? No, just close.
            };

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

                const nameColor = u.role === 'admin' ? 'var(--primary-color)' : 'var(--text-color)';
                const pabloLabel = u.isPablo ? '<span style="font-size:0.8em; color:var(--primary-color); margin-left:5px;">(Pablo-Flat)</span>' : '';

                const accordionId = `role-accordion-${u.username}`;
                const isAccordionOpen = openAccordions.has(accordionId);

                return `
                <div class="user-card" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid var(--glass-border); margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; color:${nameColor};">
                                ${u.username} 
                                <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span>
                                ${pabloLabel}
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
                    <div class="role-accordion ${isAccordionOpen ? '' : 'hidden'}" id="${accordionId}" style="margin-top:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px;">
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

        const products = DB.state.products || [];

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
                let originalPriceVal = 0;
                const catItem = products.find(p => String(p.id) === String(i.id));
                if (catItem) {
                    if (typeof catItem.price === 'number') originalPriceVal = catItem.price;
                    else if (typeof catItem.price === 'string')
                        originalPriceVal = parseFloat(catItem.price.replace('€', '').replace(',', '.').trim()) || 0;
                }

                let userPriceVal = 0;
                if (i.price && typeof i.price === 'string')
                    userPriceVal = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;

                const userPriceStr = userPriceVal.toFixed(2).replace('.', ',') + ' €';
                let priceDisplay = '';
                if (Math.abs(originalPriceVal - userPriceVal) > 0.01 && originalPriceVal > 0) {
                    const origPriceStr = originalPriceVal.toFixed(2).replace('.', ',') + ' €';
                    priceDisplay = `<span style="text-decoration:line-through; color:#888; margin-right:5px;">${origPriceStr}</span> <span style="color:var(--primary-color); font-weight:bold;">${userPriceStr}</span>`;
                } else {
                    priceDisplay = `<span>${userPriceStr}</span>`;
                }

                return `
                   <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
                        <div style="display:flex; gap: 15px;">
                            <span>${i.quantity}x ${i.name}</span>
                        </div>
                        <div>${priceDisplay}</div>
                   </div>`;
            }).join('');

            // Date formatting: HH:MM (strip seconds)
            let dateStr = o.date; // E.g. "25.1.2026, 22:45:30"
            try {
                // Split date and time
                const parts = dateStr.split(', ');
                if (parts.length > 1) {
                    const timeParts = parts[1].split(':');
                    if (timeParts.length >= 2) {
                        dateStr = parts[0] + ', ' + timeParts[0] + ':' + timeParts[1];
                    }
                }
            } catch (e) { }

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
                     <div style="font-size:0.8rem; color: #888; margin-bottom: 5px;">${dateStr}</div>
                    
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
                <span style="transform: ${isArchiveOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.3s; color:var(--text-color);">▼</span>
            `;

            const body = document.createElement('div');
            body.className = 'archive-list';
            body.style.display = isArchiveOpen ? 'grid' : 'none';
            body.style.gap = '10px';
            body.style.marginTop = '15px';
            body.style.color = 'var(--text-color)';
            body.innerHTML = archivedOrders.map(o => renderOrderCard(o, true)).join('');

            header.onclick = () => {
                const nowOpen = body.style.display === 'none';
                list.dataset.archiveOpen = nowOpen;
                body.style.display = nowOpen ? 'grid' : 'none';
                header.querySelector('span:last-child').style.transform = nowOpen ? 'rotate(180deg)' : 'rotate(0deg)';
            };

            archiveSection.appendChild(header);
            archiveSection.appendChild(body);
            content.appendChild(archiveSection);
        }

        list.onclick = async (e) => {
            const trg = e.target;
            const id = trg.dataset.id;
            if (!id) return;
            const reload = () => selfRender(elements, DB, showConfirm, selfRender);

            if (trg.classList.contains('archive-order-btn')) {
                await DB.updateOrder(id, o => o.adminArchived = true);
                reload();
            }
            if (trg.classList.contains('unarchive-order')) {
                await DB.updateOrder(id, o => o.adminArchived = false);
                reload();
            }
            if (trg.classList.contains('delete-permanent')) {
                showConfirm('Bestellung löschen?', 'Endgültig löschen?', async () => {
                    await DB.deleteOrder(id);
                    reload();
                });
            }
            if (trg.classList.contains('reject-order')) {
                const newStatus = trg.dataset.status === 'abgelehnt' ? 'open' : 'abgelehnt';
                await DB.updateOrder(id, o => o.status = newStatus);
                reload();
            }
            if (trg.classList.contains('confirm-order')) {
                const newStatus = trg.dataset.status === 'bestellt' ? 'open' : 'bestellt';
                await DB.updateOrder(id, o => o.status = newStatus);
                reload();
            }
            if (trg.classList.contains('toggle-paid')) {
                await DB.updateOrder(id, o => o.paid = !o.paid);
                reload();
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
            // ... (User creation omitted for brevity, logic exists) ...
            // Re-implement basic creation logic to be safe
            const nameIn = content.querySelector('#new-user-name');
            const passIn = content.querySelector('#new-user-pass');
            if (nameIn && passIn && nameIn.value && passIn.value) {
                try {
                    await DB.createUser(nameIn.value.trim(), passIn.value.trim());
                    selfRender(elements, DB, showConfirm, selfRender);
                } catch (e) { CoreUI.showModal('Fehler', e.message); }
            }
        };

        content.querySelectorAll('.manage-role-btn').forEach(btn => {
            btn.onclick = () => {
                const acc = content.querySelector(`#role-accordion-${btn.dataset.user}`);
                if (acc) {
                    acc.classList.toggle('hidden');
                }
            };
        });

        // --- CHECKBOX LOGIC (Fixed using setTimeout to avoid lockup) ---
        const handleRoleChange = async (e, roleType) => {
            e.preventDefault(); // Stop immediate toggle visually until confirmed
            e.stopPropagation();

            const checkbox = e.target;
            const username = checkbox.dataset.user;
            // The click event happens BEFORE checked changes effectively if prevented? 
            // If prevented, checked state is NOT toggled.
            // So we check current state:
            // If checkbox is currently unchecked, user wants to check it.
            const wantsToCheck = !checkbox.checked;

            const label = roleType === 'admin' ? 'Administrator' : 'Pablo Flatrate';
            const action = wantsToCheck ? 'geben' : 'entziehen';

            // IMPORTANT: Render modal asynchronously to let event loop clear
            setTimeout(() => {
                showAdminModal('Rolle ändern?', `Möchten Sie dem Benutzer <strong>${username}</strong> die Rolle "${label}" ${action}?`, async (modal) => {
                    const updates = {};
                    if (roleType === 'admin') updates.role = wantsToCheck ? 'admin' : 'user';
                    if (roleType === 'pablo') updates.isPablo = wantsToCheck;

                    await DB.updateUser(username, updates);
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            }, 10);
        };

        content.querySelectorAll('.role-checkbox').forEach(chk => {
            chk.onclick = (e) => handleRoleChange(e, 'admin');
        });
        content.querySelectorAll('.pablo-checkbox').forEach(chk => {
            chk.onclick = (e) => handleRoleChange(e, 'pablo');
        });

        content.querySelectorAll('.delete-user').forEach(btn => {
            btn.onclick = () => {
                const u = btn.dataset.user;
                showConfirm('Löschen?', `${u} löschen?`, async () => {
                    await DB.deleteUser(u);
                    selfRender(elements, DB, showConfirm, selfRender);
                });
            };
        });
        content.querySelectorAll('.edit-pw-btn').forEach(btn => {
            btn.onclick = () => {
                const username = btn.dataset.user;
                showAdminModal('Passwort ändern', `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <input type="text" id="modal-pw-1" placeholder="Neues Passwort">
                        <input type="text" id="modal-pw-2" placeholder="Bestätigen">
                    </div>
                `, async (modal) => {
                    const p1 = modal.querySelector('#modal-pw-1').value.trim();
                    const p2 = modal.querySelector('#modal-pw-2').value.trim();
                    if (p1 && p1 === p2) {
                        await DB.updateUser(username, { password: p1 });
                        selfRender(elements, DB, showConfirm, selfRender);
                    } else {
                        CoreUI.showModal('Fehler', 'Ungültig');
                    }
                });
            };
        });
    }
};

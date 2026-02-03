import { Search } from '../search.js';

function showAdminModal(title, htmlBody, onConfirm) {
    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.innerHTML = `
        <div class="modal-content" style="background:#18181b; color:#e4e4e7; border:1px solid rgba(255,255,255,0.1); max-width:400px; width:90%;">
            <h3 style="margin-top:0;">${title}</h3>
            <div style="margin:15px 0;">${htmlBody}</div>
            <div style="display:flex; justify-content:center; gap:10px;">
                <button class="btn btn-secondary close-modal">Abbrechen</button>
                <button class="btn btn-primary confirm-modal">Bestätigen</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
    div.querySelector('.close-modal').onclick = () => div.remove();
    div.querySelector('.confirm-modal').onclick = () => {
        onConfirm(div);
        div.remove();
    };
}

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, renderSelf, Cart) {
        const list = elements.ordersList;
        if (!list) return;

        // Ensure active tab
        if (!list.dataset.activeTab) list.dataset.activeTab = 'orders';
        const activeTab = list.dataset.activeTab;

        // Render Tabs
        list.innerHTML = `
            <div class="admin-tabs" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                <button class="btn btn-sm ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'} nav-tab" data-tab="orders">Bestellungen</button>
                <button class="btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} nav-tab" data-tab="users">Benutzer</button>
                <button class="btn btn-sm ${activeTab === 'search' ? 'btn-primary' : 'btn-secondary'} nav-tab" data-tab="search">Produkte</button>
            </div>
            <div id="admin-content"></div>
        `;

        const content = list.querySelector('#admin-content');

        list.querySelectorAll('.nav-tab').forEach(b => {
            b.onclick = () => {
                list.dataset.activeTab = b.dataset.tab;
                window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: b.dataset.tab } }));
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            };
        });

        // --- SEARCH TAB ---
        if (activeTab === 'search') {
            Search.renderSearchWidget(content, { showAddToCart: false });
            return;
        }

        // --- USERS TAB ---
        if (activeTab === 'users') {
            const users = DB.getUsers();
            content.innerHTML = '<div style="display:flex; flex-direction:column; gap:10px;"></div>';
            const container = content.firstElementChild;

            users.forEach(u => {
                const card = document.createElement('div');
                card.className = 'user-card';
                card.style.cssText = 'background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); display:flex; flex-wrap:wrap; align-items:center; gap:20px;';

                card.innerHTML = `
                    <div style="flex:1;">
                        <div style="font-weight:bold;">${u.username} <span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></div>
                        <div style="font-size:0.8em; color:#888;">Passwort: ${u.password}</div>
                    </div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin-left:auto;">
                        <button class="btn btn-sm btn-secondary manage-role-btn" data-user="${u.username}">Rollen</button>
                        ${u.username !== 'admin' ? `<button class="btn btn-sm btn-danger delete-user" data-user="${u.username}">Löschen</button>` : ''}
                    </div>
                    <div id="role-accordion-${u.username}" class="role-accordion" style="width:100%; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); display:none;">
                        <div style="display:flex; gap:10px;">
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                                <input type="checkbox" class="role-check" data-user="${u.username}" data-role="user" ${u.role === 'user' ? 'checked' : ''}> User
                            </label>
                            <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                                <input type="checkbox" class="role-check" data-user="${u.username}" data-role="admin" ${u.role === 'admin' ? 'checked' : ''}> Admin
                            </label>
                        </div>
                    </div>
                 `;
                container.appendChild(card);

                // Accordion Toggle
                const acc = card.querySelector(`#role-accordion-${u.username}`);
                const btn = card.querySelector('.manage-role-btn');
                if (btn) btn.onclick = () => {
                    acc.style.display = acc.style.display === 'none' ? 'block' : 'none';
                    list.dataset[`acc-${u.username}`] = acc.style.display === 'block' ? 'open' : '';
                };
                if (list.dataset[`acc-${u.username}`] === 'open') acc.style.display = 'block';

                // Role Change
                card.querySelectorAll('.role-check').forEach(chk => {
                    chk.onchange = () => {
                        if (chk.checked) {
                            u.role = chk.dataset.role;
                            DB.saveUsers();
                            renderSelf(elements, DB, showConfirm, renderSelf, Cart);
                        } else chk.checked = true;
                    };
                });

                // Delete
                const del = card.querySelector('.delete-user');
                if (del) del.onclick = () => {
                    showAdminModal('Benutzer löschen', `<p>Bestätigen Sie das Passwort von <b>${u.username}</b>:</p><input type="text" id="del-pass" style="width:100%; padding:8px; margin-top:5px; background:rgba(0,0,0,0.3); border:1px solid #555; color:white;">`, (modal) => {
                        const v = modal.querySelector('#del-pass').value;
                        if (v === u.password) {
                            DB.deleteUser(u.username);
                            renderSelf(elements, DB, showConfirm, renderSelf, Cart);
                        } else alert('Falsches Passwort');
                    });
                };
            });
            return;
        }

        // --- ORDERS TAB ---
        const products = DB.state.products || [];
        const users = DB.getUsers();
        let orders = DB.getOrders();

        // Sorting: Newest First
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Note: Recreating the logic for Order Filtering (Users scroll list)
        // I assume this logic existed.
        const selectedUser = list.dataset.selectedUser || '';

        // User Filter UI
        const userFilterHTML = `
            <div style="margin-bottom:15px; overflow-x:auto; white-space:nowrap; padding-bottom:5px;">
                <button class="btn btn-sm ${selectedUser === '' ? 'btn-primary' : 'btn-secondary'} user-filter" data-user="">Alle</button>
                ${users.map(u => `<button class="btn btn-sm ${selectedUser === u.username ? 'btn-primary' : 'btn-secondary'} user-filter" data-user="${u.username}">${u.username}</button>`).join('')}
            </div>
        `;
        content.innerHTML = userFilterHTML + '<div id="orders-container"></div>';

        // Bind Filters
        content.querySelectorAll('.user-filter').forEach(b => {
            b.onclick = () => {
                list.dataset.selectedUser = b.dataset.user;
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            };
        });

        const ordersContainer = content.querySelector('#orders-container');

        // Filter Logic
        let displayOrders = orders;
        if (selectedUser) displayOrders = orders.filter(o => o.user === selectedUser);

        if (displayOrders.length === 0) {
            ordersContainer.innerHTML = '<p style="color:#888;">Keine Bestellungen vorhanden.</p>';
            return;
        }

        // Render Cards
        const renderCard = (o) => {
            const isArchive = !!o.archivedBy && o.archivedBy.includes('admin');
            const isCancelled = o.status === 'cancelled';
            const cardOpacity = isArchive ? '0.6' : '1';
            const cardBg = isArchive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)';

            let dateStr = o.date;
            try {
                const d = new Date(o.date);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    }) + ', ' + d.toLocaleTimeString('de-DE', {
                        hour: '2-digit', minute: '2-digit'
                    });
                }
            } catch (e) { }

            // PROFIT CALCULATION & Item Rendering
            let calcSelling = 0;
            let calcBuying = 0;

            const itemsHtml = (o.items || []).map(i => {
                const orderUser = DB.getUsers().find(u => u.username === o.user);
                let origPrice = 0;

                // Catalog Item Lookup
                let catItem = products.find(p => String(p.id) === String(i.id));
                if (!catItem) {
                    catItem = products.find(p => p.title === i.name || p.name === i.name);
                }

                // Buying Price Logic
                if (i.originalPrice) {
                    origPrice = parseFloat(String(i.originalPrice).replace(',', '.'));
                } else {
                    if (catItem) {
                        if (catItem.originalPrice) origPrice = parseFloat(String(catItem.originalPrice).replace(',', '.'));
                        else if (typeof catItem.price === 'number') origPrice = catItem.price;
                    }
                    if (origPrice === 0) {
                        let storedP = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                        origPrice = storedP;
                    }
                }

                // Selling Price
                let userPrice = 0;
                if (Cart && orderUser) {
                    userPrice = Cart.calculatePrice(i, orderUser);
                } else {
                    userPrice = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                }

                const q = i.quantity || 1;
                calcSelling += userPrice * q;
                calcBuying += origPrice * q;

                const userPriceStr = userPrice.toFixed(2).replace('.', ',') + ' €';
                const origPriceStr = origPrice.toFixed(2).replace('.', ',') + ' €';

                let priceDisplay = `<span>${userPriceStr}</span>`;
                if (Math.abs(origPrice - userPrice) > 0.01 && origPrice > 0) {
                    priceDisplay = `<span style="color:#888; font-size:0.9em; margin-right:8px;">${origPriceStr}</span><span>${userPriceStr}</span>`;
                }

                // Product Link Logic
                let nameDisplay = i.name;
                const handle = i.handle || (catItem ? catItem.handle : null);

                if (handle) {
                    const url = `https://snuzone.com/products/${handle}`;
                    nameDisplay = `<a href="${url}" target="_blank" style="color:var(--text-color); text-decoration:none; border-bottom:1px dotted #666;">${i.name}</a>`;
                }

                return `<div style="display:flex; justify-content:space-between; align-items:flex-end; gap:25px; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:3px;">
                            <span style="flex:1;">${q}x ${nameDisplay}</span>
                            <div style="flex-shrink:0;">${priceDisplay}</div>
                        </div>`;
            }).join('');

            const sellingStr = calcSelling.toFixed(2).replace('.', ',') + ' €';
            const buyingStr = calcBuying.toFixed(2).replace('.', ',') + ' €';
            const profitVal = calcSelling - calcBuying;
            const profitStr = profitVal.toFixed(2).replace('.', ',') + ' €';
            const profitColor = profitVal >= 0 ? '#059669' : '#be123c';

            let displayStatus = o.status.toUpperCase();
            if (displayStatus === 'OPEN') displayStatus = 'OFFEN';

            let statusBadge = `<span class="status-badge status-${o.status}">${displayStatus}</span>`;

            // Paid Badge
            if (o.status === 'bestellt') {
                const pTxt = o.paid ? 'BEZAHLT' : 'NICHT BEZAHLT';
                // SIMPLE STYLE (Step 1615)
                const pCol = o.paid ? '#059669' : '#be123c';
                const pStyle = o.paid ? `background:transparent; color:#059669; border:1px solid #059669;` : `background:transparent; color:#be123c; border:1px solid #be123c;`;
                statusBadge += `<span style="margin-left:8px; padding:2px 6px; border-radius:4px; font-size:0.75em; font-weight:bold; ${pStyle}">${pTxt}</span>`;
            }

            let btns = '';
            if (isArchive) {
                btns = `
                    <button class="btn btn-primary btn-sm unarchive-order" data-id="${o.id}">Wiederherstellen</button>
                    <button class="btn btn-danger btn-sm delete-permanent" data-id="${o.id}">Löschen</button>
                 `;
            } else if (isCancelled) {
                btns = `
                    <div style="font-weight:bold; color:#be123c; margin-bottom:5px; text-align:center;">STORNIERT</div>
                    <button class="btn btn-primary btn-sm archive-order-btn" data-id="${o.id}" style="width:100%;">Archivieren</button>
                `;
            } else {
                const confirmBtn = `
                        <button class="btn btn-sm confirm-order" data-id="${o.id}" 
                             style="background: ${o.status === 'bestellt' ? 'linear-gradient(135deg, #059669 0%, #047857 50%, #059669 100%)' : 'transparent'}; 
                                    background-size: 200% 200%; border: 1px solid #059669; color: ${o.status === 'bestellt' ? 'white' : '#059669'}; width:100%;">
                            ${o.status === 'bestellt' ? 'Bestätigt' : 'Bestätigen'}
                        </button>`;

                // SIMPLE STYLE (Step 1615)
                const paidBtn = o.status === 'bestellt' ? `
                            <button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" 
                                style="${o.paid ? 'background:transparent; color:#059669; border:1px solid #059669;' : 'background:transparent; color:#be123c; border:1px solid #be123c;'} width:100%;">
                                ${o.paid ? 'Bezahlt' : 'Nicht bezahlt'}
                            </button>` : '';

                btns = `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn btn-sm reject-order" data-id="${o.id}" 
                            style="background: ${o.status === 'abgelehnt' ? 'linear-gradient(135deg, #be123c 0%, #9f1239 50%, #be123c 100%)' : 'transparent'}; 
                                   background-size: 200% 200%; border: 1px solid #be123c; color: ${o.status === 'abgelehnt' ? 'white' : '#be123c'}; width:100%;">
                            ${o.status === 'abgelehnt' ? 'Abgelehnt' : 'Ablehnen'}
                        </button>
                        
                        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                            ${confirmBtn}
                            ${paidBtn}
                        </div>

                        <button class="btn btn-secondary btn-sm archive-order-btn" data-id="${o.id}" style="width:100%; margin-top:5px;">Archivieren</button>
                    </div>
                 `;
            }

            return `
            <div class="order-card" style="opacity:${cardOpacity}; background:${cardBg}; border:1px solid var(--glass-border); border-radius:8px; padding:10px; margin-bottom:10px; display:flex;">
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between;">
                        <div><b>${o.id}</b> <span style="color:#888">(${o.user})</span> <span style="margin-left:8px;">${statusBadge}</span></div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; font-size:1.1em;">${sellingStr}</div>
                            <div style="font-size:0.8em; color:#888;">Einkaufspreis: ${buyingStr}</div>
                            <div style="font-size:0.8em; color:${profitColor};">Gewinn: ${profitStr}</div>
                        </div>
                    </div>
                    <div style="font-size:0.8em; color:#888; margin:2px 0 8px 0;">${dateStr}</div>
                    ${o.note ? `<div style="font-size:0.9em; color:#ddd; background:rgba(255,255,255,0.05); padding:6px; border-radius:4px; margin:0 0 8px 0; font-style:italic;">"${o.note}"</div>` : ''}
                    <div style="font-size:0.9em; color:#ccc;">${itemsHtml}</div>
                    
                    ${(!isArchive && !isCancelled) ? `
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">
                        <textarea class="form-control admin-note-input" data-id="${o.id}" rows="3" placeholder="Admin Notiz..." style="width:100%; margin-bottom:8px; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); color:white; resize:none; padding:8px; border-radius:4px;">${o.adminNote || ''}</textarea>
                        <button class="btn btn-secondary btn-sm save-note-btn" data-id="${o.id}" style="width:100%">Notiz Speichern</button>
                    </div>` : ''}

                    ${isCancelled ? `<div style="margin-top:10px; font-style:italic; color:#be123c;">Bestellung wurde vom Nutzer storniert.</div>` : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; min-width:140px;">${btns}</div>
            </div>`;
        };

        ordersContainer.innerHTML = displayOrders.map(renderCard).join('');

        // Handlers
        ordersContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;

            // Status Actions
            if (btn.classList.contains('confirm-order')) {
                DB.updateOrder(id, o => o.status = 'bestellt');
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            }
            if (btn.classList.contains('reject-order')) {
                DB.updateOrder(id, o => o.status = 'abgelehnt');
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            }
            if (btn.classList.contains('toggle-paid')) {
                DB.updateOrder(id, o => o.paid = !o.paid);
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            }

            // Archive Actions
            if (btn.classList.contains('archive-order-btn')) {
                DB.updateOrder(id, o => {
                    if (!o.archivedBy) o.archivedBy = [];
                    if (!o.archivedBy.includes('admin')) o.archivedBy.push('admin');
                });
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            }
            if (btn.classList.contains('unarchive-order')) {
                DB.updateOrder(id, o => {
                    if (o.archivedBy) o.archivedBy = o.archivedBy.filter(x => x !== 'admin');
                });
                renderSelf(elements, DB, showConfirm, renderSelf, Cart);
            }
            if (btn.classList.contains('delete-permanent')) {
                showAdminModal('Endgültig löschen?', 'Diese Bestellung wird unwiderruflich aus der Datenbank entfernt.', () => {
                    DB.deleteOrder(id);
                    renderSelf(elements, DB, showConfirm, renderSelf, Cart);
                });
            }

            // Admin Note
            if (btn.classList.contains('save-note-btn')) {
                const noteInput = ordersContainer.querySelector(`.admin-note-input[data-id="${id}"]`);
                if (noteInput) {
                    const val = noteInput.value;
                    DB.updateOrder(id, o => o.adminNote = val);
                    // Feedback
                    const originalText = btn.innerText;
                    btn.innerText = 'Gespeichert!';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        // Optional: Re-render if needed, but usually not for text update
                    }, 1000);
                }
            }
        });
    }
};

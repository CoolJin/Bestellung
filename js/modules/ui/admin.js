// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';

export const AdminUI = {
    async renderAdminDashboard(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState) {
        const list = elements.ordersList;
        if (!list) return;

        // Default to 'orders' if not set, OR 'search' if user prefers? 
        // User complained "Orders gone". Reverting default to 'orders' might be safer, 
        // but he explicitly asked for "Search, Extra, Orders, Users". 
        // However, standard behavior for dashboards is usually Orders.
        // Let's keep 'search' as default if he asked for that order, BUT ensure tab switching works.
        // If dataset is empty, set default.
        if (!list.dataset.activeTab) list.dataset.activeTab = 'search';

        let activeTab = list.dataset.activeTab;
        let selectedUserFilter = list.dataset.selectedUser || null;

        const openAccordions = new Set();
        list.querySelectorAll('.role-accordion.open').forEach(acc => openAccordions.add(acc.id));

        const isArchiveOpen = list.dataset.archiveOpen === 'true';

        // --- GLOBAL EXTRAS USER INIT ---
        const EXTRAS_USER_ID = 'admin_extras_storage';
        let extrasUser = DB.getUsers().find(u => u.username === EXTRAS_USER_ID);
        if (!extrasUser) {
            try {
                await DB.createUser(EXTRAS_USER_ID, 'internal_storage_' + Date.now());
                extrasUser = DB.getUsers().find(u => u.username === EXTRAS_USER_ID);
            } catch (e) {
                console.error('Failed to create extras storage:', e);
            }
        }

        list.innerHTML = '';
        const content = document.createElement('div');
        list.appendChild(content);

        // --- Local Internal Modal ---
        const localShowAdminModal = (title, contentHTML, onConfirm) => {
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
                    <div class="modal-actions" style="display:flex; justify-content:center; gap:10px;">
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

        // --- TAB CONTENT ---

        // 1. SEARCH TAB
        if (activeTab === 'search') {
            content.innerHTML = `
                <div class="admin-panel">
                    <h3>Produktsuche (Extras hinzufügen)</h3>
                    <div style="margin-bottom:20px;">
                        <input type="text" id="admin-search-input" placeholder="Produkt suchen..." class="form-input" style="width:100%; padding:12px; font-size:1.1em; border-radius:8px; border:1px solid var(--primary-color); background:rgba(0,0,0,0.3); color:white;">
                    </div>
                    <div id="admin-search-results" class="product-grid"></div>
                </div>
            `;

            const input = content.querySelector('#admin-search-input');
            const resultsDiv = content.querySelector('#admin-search-results');
            const products = (appState && appState.products) ? appState.products : DB.state.products;

            const renderResults = (query) => {
                const q = query.toLowerCase().trim();
                let hits = products;
                if (q.length > 0) {
                    hits = products.filter(p => p.title.toLowerCase().includes(q) || (p.handle && p.handle.toLowerCase().includes(q)));
                } else {
                    hits = []; // Don't show everything by default to keep clean? Or show all? User Catalog shows all. Let's show empty until search.
                }

                // Matches User Catalog Design (Standard product-card)
                resultsDiv.innerHTML = hits.slice(0, 50).map(p => {
                    const price = (typeof p.price === 'number') ? p.price.toFixed(2).replace('.', ',') + ' €' : p.price;
                    const img = p.images && p.images[0] ? p.images[0].src : 'https://via.placeholder.com/150';
                    return `
                    <article class="product-card">
                         <img src="${img}" class="product-image" alt="${p.title}" style="height:150px; object-fit:contain; width:100%; border-radius:8px;">
                         <div class="product-info" style="padding:10px;">
                             <h3 style="font-size:1em; margin:0 0 10px 0; height:40px; overflow:hidden;">${p.title}</h3>
                             <div class="product-footer" style="display:flex; justify-content:space-between; align-items:center;">
                                 <div class="product-price" style="font-weight:bold; color:var(--primary-color);">${price}</div>
                                 <button class="btn btn-primary btn-sm add-to-extra" data-id="${p.id}" style="padding:5px 10px;">+ Extra</button>
                             </div>
                         </div>
                     </article>`;
                }).join('');

                resultsDiv.querySelectorAll('.add-to-extra').forEach(b => {
                    b.onclick = async () => {
                        if (!extrasUser) return;
                        const pid = b.dataset.id;
                        const product = products.find(p => String(p.id) === String(pid));
                        if (product && cartHelper) {
                            let currentCart = extrasUser.cart || [];
                            const item = JSON.parse(JSON.stringify(product));
                            item.quantity = 1;
                            // Calculate Price
                            const effectivePrice = cartHelper.calculatePrice(item, extrasUser);
                            item.price = effectivePrice.toFixed(2).replace('.', ',') + ' €';

                            const existing = currentCart.find(i => String(i.id) === String(item.id));
                            if (existing) {
                                existing.quantity = (existing.quantity || 1) + 1;
                                existing.price = item.price;
                            } else {
                                currentCart.push(item);
                            }

                            await DB.saveCart(EXTRAS_USER_ID, currentCart);
                            CoreUI.showModal('Hinzugefügt', `${item.title} zu Extras hinzugefügt.`);
                        }
                    };
                });
            };

            input.oninput = (e) => renderResults(e.target.value);
            // Optionally render initial "Popular" or just empty
            renderResults(""); // Show nothing initially? Or All?
            // User Catalog shows "All" initially.
            // But Admin might not want clutter. 
            // I'll show nothing initially to encourage search.
        }

        // 2. EXTRA TAB
        else if (activeTab === 'extra') {
            const cartItems = (extrasUser && extrasUser.cart) ? extrasUser.cart : [];
            const totalItems = cartItems.reduce((acc, i) => acc + (i.quantity || 0), 0);

            // Calculate Value?
            let totalValue = 0;
            cartItems.forEach(i => {
                const price = parseFloat(i.price.replace('€', '').replace(',', '.').trim()) || 0;
                totalValue += price * (i.quantity || 1);
            });
            const totalValueStr = totalValue.toFixed(2).replace('.', ',') + ' €';

            let listHtml = '';
            if (cartItems.length === 0) {
                listHtml = '<p style="color:#888;">Keine Extras im Bestand.</p>';
            } else {
                listHtml = cartItems.map(i => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:10px;">
                        <div style="flex:1;">
                            <div style="font-weight:bold;">${i.title || i.name}</div>
                            <div style="font-size:0.85em; color:#888;">${i.price}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button class="btn btn-secondary btn-sm dec-extra" data-id="${i.id}" style="width:30px;">-</button>
                            <span style="font-weight:bold; min-width:30px; text-align:center;">${i.quantity}</span>
                            <button class="btn btn-secondary btn-sm inc-extra" data-id="${i.id}" style="width:30px;">+</button>
                            <button class="btn btn-danger btn-sm del-extra" data-id="${i.id}" style="margin-left:10px;">✕</button>
                        </div>
                    </div>
                `).join('');
            }

            content.innerHTML = `
                <div class="admin-panel">
                    <h3>Extras Lagerbestand</h3>
                    <div style="display:flex; gap:20px; margin-bottom:20px; font-size:1.1em; color:var(--primary-color);">
                        <span>Gesamt Dosen: <b>${totalItems}</b></span>
                        <span>Gesamtwert: <b>${totalValueStr}</b></span>
                    </div>
                    <div style="margin-top:20px;">
                        ${listHtml}
                    </div>
                </div>
            `;

            // Handlers
            const updateExtraQty = async (id, delta) => {
                if (!extrasUser) return;
                let cart = extrasUser.cart || [];
                const idx = cart.findIndex(c => String(c.id) === String(id));
                if (idx !== -1) {
                    cart[idx].quantity = (cart[idx].quantity || 1) + delta;
                    if (cart[idx].quantity <= 0) {
                        cart.splice(idx, 1);
                    }
                    await DB.saveCart(EXTRAS_USER_ID, cart);
                    selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
                }
            };

            content.querySelectorAll('.inc-extra').forEach(b => b.onclick = () => updateExtraQty(b.dataset.id, 1));
            content.querySelectorAll('.dec-extra').forEach(b => b.onclick = () => updateExtraQty(b.dataset.id, -1));
            content.querySelectorAll('.del-extra').forEach(b => b.onclick = async () => {
                let cart = extrasUser.cart || [];
                cart = cart.filter(c => String(c.id) !== String(b.dataset.id));
                await DB.saveCart(EXTRAS_USER_ID, cart);
                selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
            });
        }

        // 3. USERS TAB
        else if (activeTab === 'users') {
            // ... Code from Previous Step (Omitted for brevity, but I MUST include it) 
            // Logic identical to Step 1693
            const users = DB.getUsers();
            const visibleUsers = users.filter(u => u.username !== EXTRAS_USER_ID);

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
                        ${visibleUsers.map(u => {
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
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:20px;">
                                    <div>
                                        <div style="font-weight:bold; color:${nameColor};">${u.username} <span style="font-size:0.8em; color:var(--text-muted);">(${u.role})</span>${pabloLabel}</div>
                                        <div style="font-size:0.85em; color:var(--text-muted); margin-top:2px;">Passwort: ${u.password}</div>
                                    </div>
                                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin-left:auto;">
                                        ${showOrdersBtn}
                                        <button class="btn btn-sm btn-secondary edit-pw-btn" data-user="${u.username}">Passwort ändern</button>
                                        <button class="btn btn-sm btn-secondary manage-role-btn" data-user="${u.username}">Rollen</button>
                                        ${showDeleteBtn}
                                    </div>
                                </div>
                                <div class="role-accordion ${isAccordionOpen ? 'open' : ''}" id="${accordionId}" style="margin-top:10px; padding:0 10px; background:rgba(0,0,0,0.2); border-radius:6px; overflow:hidden;">
                                     <div style="display:flex; flex-direction:column; gap:8px; padding: 10px 0;">
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
            AdminUI.setupUserHandlers(content, DB, elements, showConfirm, selfRender, localShowAdminModal, cartHelper, appState);
        }

        // 4. ORDERS TAB (Explicit)
        else {
            // ACTIVE TAB IS 'orders' OR UNKNOWN
            // Ensure we update dataset only if it was unknown?
            if (activeTab !== 'orders') list.dataset.activeTab = 'orders';

            let allOrders = DB.getOrders().filter(o => !o.deletedByAdmin).sort((a, b) => b.id.localeCompare(a.id));
            const activeOrders = allOrders.filter(o => !o.adminArchived);
            const archivedOrders = allOrders.filter(o => o.adminArchived);
            const products = (appState && appState.products) ? appState.products : (DB.state.products || []);

            let displayOrders = activeOrders;
            // FILTER BY USER
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
                        selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
                    };
                }, 0);
            }

            // ORDER CARD RENDERER
            const renderOrderCard = (o, isArchive) => {
                let total = o.total;

                // Layout fix for Archive
                const cardBg = isArchive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
                const cardOpacity = isArchive ? '0.75' : '1';

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

                let calcSelling = 0;
                let calcBuying = 0;

                const itemsHtml = (o.items || []).map(i => {
                    const orderUser = DB.getUsers().find(u => u.username === o.user);
                    let origPrice = 0;

                    let catItem = products.find(p => String(p.id) === String(i.id));
                    if (!catItem) {
                        catItem = products.find(p => p.title === i.name || p.name === i.name);
                    }

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

                    let userPrice = 0;
                    if (cartHelper && orderUser) {
                        userPrice = cartHelper.calculatePrice(i, orderUser);
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

                if (o.status === 'bestellt') {
                    const pTxt = o.paid ? 'BEZAHLT' : 'NICHT BEZAHLT';
                    const pStyle = o.paid ?
                        `background:transparent; color:#059669; border:1px solid #059669;` :
                        `background:transparent; color:#be123c; border:1px solid #be123c;`;
                    statusBadge += `<span style="margin-left:8px; ${pStyle} padding:2px 6px; border-radius:4px; font-size:0.75em; font-weight:bold;">${pTxt}</span>`;
                }

                let btns = '';
                const isCancelled = o.status === 'cancelled';

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
                            <button class="btn btn-sm confirm-order" data-id="${o.id}" data-status="${o.status}" 
                                 style="background: ${o.status === 'bestellt' ? 'linear-gradient(135deg, #059669 0%, #047857 50%, #059669 100%)' : 'transparent'}; 
                                        background-size: 200% 200%; border: 1px solid #059669; color: ${o.status === 'bestellt' ? 'white' : '#059669'}; width:100%;">
                                ${o.status === 'bestellt' ? 'Bestätigt' : 'Bestätigen'}
                            </button>`;

                    const paidBtn = o.status === 'bestellt' ? `
                                <button class="btn btn-secondary btn-sm toggle-paid" data-id="${o.id}" 
                                    style="${o.paid ? 'background:transparent; color:#059669; border:1px solid #059669;' : 'background:transparent; color:#be123c; border:1px solid #be123c;'} width:100%;">
                                    ${o.paid ? 'Bezahlt' : 'Nicht bezahlt'}
                                </button>` : '';

                    btns = `
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <button class="btn btn-sm reject-order" data-id="${o.id}" data-status="${o.status}" 
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

            const activeHtml = displayOrders.length ? displayOrders.map(o => renderOrderCard(o, false)).join('') : '<p style="color:#888; padding:10px;">Keine aktiven Bestellungen.</p>';
            const mainDiv = document.createElement('div');
            mainDiv.innerHTML = activeHtml;
            content.appendChild(mainDiv);

            if (archivedOrders.length > 0) {
                const archDiv = document.createElement('div');
                archDiv.innerHTML = `
                    <details id="admin-archive-details" style="margin-top:40px; background:rgba(255,255,255,0.02); border-radius:8px; overflow:hidden;" ${isArchiveOpen ? 'open' : ''}>
                        <summary style="padding:15px; cursor:pointer; font-weight:bold; background:rgba(255,255,255,0.05); color:var(--text-color);">Archiv (${archivedOrders.length})</summary>
                        <div class="archive-list" style="padding:15px; display:grid; gap:15px; min-height:50px; opacity:1 !important; transform:none !important; animation:none !important;">
                            ${archivedOrders.map(o => {
                    try { return renderOrderCard(o, true); }
                    catch (e) { console.error('Archive Render Error', o, e); return `<div style="color:red; padding:10px; border:1px solid red;">Error rendering order ${o.id}</div>`; }
                }).join('')}
                        </div>
                    </details>
                `;
                content.appendChild(archDiv);
                setTimeout(() => {
                    const det = content.querySelector('#admin-archive-details');
                    if (det) det.ontoggle = () => list.dataset.archiveOpen = det.open;
                }, 0);
            }

            // LISTENERS FOR ORDERS
            list.onclick = async (e) => {
                const t = e.target;
                const id = t.dataset.id;
                const reload = () => selfRender(elements, DB, showConfirm, selfRender, localShowAdminModal, cartHelper, appState);

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
        }
    },

    setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal, cartHelper, appState) {
        // ... (Exact Copy of Previous implementation)
        const createBtn = content.querySelector('#create-user-btn');
        if (createBtn) createBtn.onclick = async () => {
            // ...
            const u = content.querySelector('#new-user-name').value.trim();
            const p = content.querySelector('#new-user-pass').value.trim();
            if (u && p) {
                try { await DB.createUser(u, p); selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState); }
                catch (e) { CoreUI.showModal('Fehler', e.message); }
            }
        };

        content.querySelectorAll('.manage-role-btn').forEach(b => {
            b.onclick = () => {
                const acc = content.querySelector(`#role-accordion-${b.dataset.user}`);
                acc.classList.toggle('open');
            };
        });

        const safeRoleHandler = (e, type) => {
            // ...
            e.preventDefault();
            e.stopPropagation();

            const chk = e.target;
            const username = chk.dataset.user;
            const intendedState = chk.checked;
            const label = type === 'admin' ? 'Administrator' : 'Pablo Flatrate';
            const action = intendedState ? 'geben' : 'entziehen';

            showAdminModal('Rolle ändern', `Soll <strong>${username}</strong> ${label} ${action}?`, async () => {
                const updates = {};
                if (type === 'admin') updates.role = intendedState ? 'admin' : 'user';
                if (type === 'pablo') updates.isPablo = intendedState;
                try {
                    await DB.updateUser(username, updates);
                    setTimeout(() => selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState), 50);
                } catch (e) { CoreUI.showModal('Fehler', 'Speichern fehlgeschlagen.'); }
            });
        };

        content.querySelectorAll('.role-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'admin'));
        content.querySelectorAll('.pablo-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'pablo'));

        // ... Delete and PW Edit handlers must also use selfRender with appState
        content.querySelectorAll('.delete-user').forEach(b => b.onclick = () => {
            const u = b.dataset.user;
            const userObj = DB.getUsers().find(user => user.username === u);
            if (!userObj) return;

            showAdminModal('Benutzer Löschen',
                `<p>Möchten Sie den Benutzer <strong>${u}</strong> wirklich löschen?</p>
                 <p style="font-size:0.9em; color:#fca5a5; margin-bottom:10px;">Bitte geben Sie zur Bestätigung das aktuelle Passwort dieses Benutzers ein.</p>
                 <input type="text" id="confirm-del-pass" placeholder="Passwort eingeben" class="form-input" style="padding:10px; border-radius:8px; border:1px solid var(--glass-border); background:rgba(0,0,0,0.5); color:white; width:100%;">`,
                async (modal) => {
                    const inputPass = modal.querySelector('#confirm-del-pass').value;
                    if (inputPass === userObj.password) {
                        await DB.deleteUser(u);
                        selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
                    } else {
                        CoreUI.showModal('Fehler', 'Falsches Passwort. Benutzer nicht gelöscht.');
                    }
                }
            );
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
                        selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
                    } else if (p1 !== p2) {
                        CoreUI.showModal('Fehler', 'Passwörter stimmen nicht überein.');
                    }
                });
        });

        content.querySelectorAll('.view-user-orders').forEach(b => {
            b.onclick = () => {
                const list = elements.ordersList;
                list.dataset.selectedUser = b.dataset.user;
                list.dataset.activeTab = 'orders';
                window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: 'orders' } }));
                selfRender(elements, DB, showConfirm, selfRender, showAdminModal, cartHelper, appState);
            };
        });
    }
};

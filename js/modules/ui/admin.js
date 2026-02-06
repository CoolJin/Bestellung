// --- js/modules/ui/admin.js ---
import { CoreUI } from './core.js';

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender, cartHelper, Search) {
        const list = elements.ordersList;
        if (!list) return;

        // Default to 'orders' as per user request
        let activeTab = list.dataset.activeTab || 'orders';
        // Note: main.js sets dataset.activeTab when clicking nav links.

        let selectedUserFilter = list.dataset.selectedUser || null;

        const openAccordions = new Set();
        list.querySelectorAll('.role-accordion.open').forEach(acc => openAccordions.add(acc.id));

        const isArchiveOpen = list.dataset.archiveOpen === 'true';

        list.innerHTML = '';
        const content = document.createElement('div');
        list.appendChild(content);

        // --- NEW TABS: SEARCH & EXTRAS ---
        if (activeTab === 'search') {
            this.renderAdminSearch(content, elements, window.app.state, cartHelper, Search);
            return;
        }
        if (activeTab === 'extras') {
            this.renderAdminExtras(content, window.app.state, selfRender, DB, cartHelper, Search, showConfirm, elements);
            return;
        }

        // --- LEGACY MODAL DEF ---
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

        // --- USERS TAB (Legacy) ---
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
            AdminUI.setupUserHandlers(content, DB, elements, showConfirm, selfRender, localShowAdminModal, cartHelper, Search);
            return;
        }

        // --- ORDERS TAB (Legacy) ---
        // Fallback or explicit check
        if (activeTab === 'orders') {
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
                        selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search);
                    };
                }, 0);
            }

            const renderOrderCard = (o, isArchive) => {
                let total = o.total;

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
                    const pCol = o.paid ? '#059669' : '#be123c';
                    const pBg = o.paid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                    statusBadge += `<span style="margin-left:8px; border:1px solid ${pCol}; color:${pCol}; background:${pBg}; padding:2px 6px; border-radius:4px; font-size:0.75em; font-weight:bold;">${pTxt}</span>`;
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

            // --- Event Delegation (Orders) ---
            list.onclick = async (e) => {
                const t = e.target;
                const id = t.dataset.id;
                const reload = () => selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search);

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

    // --- HELPER: RENDER SEARCH (Fixed to use shared Search Module) ---
    renderAdminSearch(container, elements, state, Cart, Search) {
        // Reuse the main Search module logic but map elements to this local container
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="header-actions" style="flex-direction:column; align-items:center; gap:10px;">
                <h2 style="margin:0;">Produktsuche</h2>
                <div class="search-wrapper" style="max-width:400px; position:relative; width:100%; display:flex; justify-content:center;">
                    <span class="search-icon" style="left: 15px;">&#128269;</span>
                    <input type="text" id="admin-snuzone-search" placeholder="Suche..." class="search-input" style="width:100%;">
                    <button id="admin-search-clear" class="search-clear">✕</button>
                    <!-- Loading Indicator for Admin -->
                    <div id="admin-search-loading" style="display:none; position:absolute; right:40px; top:50%; transform:translateY(-50%); color:var(--primary-color);">
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    </div>
                </div>
            </div>
            <div id="admin-search-results" class="product-grid" style="margin-top:20px; min-height:50px;">
                <!-- Results injected here -->
            </div>
        `;
        container.appendChild(wrapper);

        const input = wrapper.querySelector('#admin-snuzone-search');
        const clearBtn = wrapper.querySelector('#admin-search-clear');
        const grid = wrapper.querySelector('#admin-search-results');
        const loader = wrapper.querySelector('#admin-search-loading'); // Placeholder if we want local loader, but Search.js handles grid content

        // Create a proxy elements object to trick Search.js into rendering here
        const proxyElements = {
            ...elements,
            snuzoneSearch: input,
            snuzoneResultsGrid: grid,
            // Override toggle functionality if needed, or ensure these don't break Search.js
            productsSection: document.createElement('div'), // Dummy
            productGrid: document.createElement('div'), // Dummy
            cartCount: null // No cart count update needed here or handled by callback
        };

        // Custom addToCart that adds to Admin Extras
        const addToExtras = (product, qty, st, cb) => {
            // Manual implementation to bypass local cart and go to DB shared state
            let currentExtras = DB.state.adminExtras || [];
            // Check if exists
            const existing = currentExtras.find(i => i.id === product.id);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + 1;
            } else {
                currentExtras.push({ ...product, quantity: 1 });
            }
            DB.saveAdminExtras(currentExtras).then(() => {
                CoreUI.showModal('Hinzugefügt', `${product.name} zu Extras hinzugefügt.`);
                if (cb) cb();
            });
        };

        // Init the Search module for this specific context if needed, 
        // OR just call handleSearch manually. 
        // Best approach: Manually bind events to call Search.handleSearch with THIS context.

        if (Search && input) {
            // We need to inject the proper elements into the Search module context 
            // OR pass them as arguments if handleSearch supports it.
            // Looking at Search.js, it uses `this.elements`. 
            // So we can temporary bind the Search object or just clone it.
            // Refactor Plan: We updated Search.js to use `this.elements`. 
            // To reuse it without breaking main User search, we can create a temporary instance or just clone it.

            const AdminSearchContext = Object.create(Search);
            AdminSearchContext.elements = proxyElements;
            AdminSearchContext.state = state;
            AdminSearchContext.addToCart = addToExtras;

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur(); // Hide keyboard
                    AdminSearchContext.handleSearch(input.value);
                }
            });

            clearBtn.addEventListener('click', () => {
                input.value = '';
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:gray; padding:20px;">Suche starten...</div>';
            });
        }
    },

    // --- HELPER: RENDER EXTRAS (Shared Admin Cart) ---
    renderAdminExtras(container, state, selfRender, DB, Cart, Search, showConfirm, elements) {
        const cartItems = DB.state.adminExtras || [];

        let totalSelling = 0;
        let totalBuying = 0;

        // Helper to fetch nicotine (Shared / Static)
        const fetchNicotineForHandle = async (handle) => {
            const targetUrl = `https://snuzone.com/products/${handle}`;
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
                `https://corsproxy.io/?${targetUrl}`
            ];

            for (const proxy of proxies) {
                try {
                    const res = await fetch(proxy);
                    let text = '';
                    if (proxy.includes('allorigins')) {
                        const json = await res.json();
                        text = json.contents;
                    } else {
                        text = await res.text();
                    }

                    // Regex for "50 MG/G" pattern (commonly found in variants or labels)
                    // Pattern: Number + space + MG/G (case insensitive)
                    // Also check for "public_title":"50 MG/G" in JSON
                    const matchJSON = text.match(/"public_title":"(\d+\s*MG\/G)"/i);
                    if (matchJSON && matchJSON[1]) return matchJSON[1];

                    const matchText = text.match(/(\d+)\s*MG\/G/i);
                    if (matchText) return `${matchText[1]} MG/G`;

                    // Fallback: Check for "mg/g" text content
                    const matchSmall = text.match(/(\d+)\s*mg\/g/i);
                    if (matchSmall) return `${matchSmall[1]} mg/g`;

                } catch (e) {
                    console.warn('Proxy failed', proxy, e);
                }
            }
            return null;
        };

        // Trigger fetches for missing info
        cartItems.forEach((item, idx) => {
            if (item.handle && !item.nicotine && !item.fetchingNicotine) {
                item.fetchingNicotine = true; // Flag to prevent double fetch
                fetchNicotineForHandle(item.handle).then(nicotine => {
                    if (nicotine) {
                        const currentItems = DB.state.adminExtras;
                        // Find item again by handle in case index shifted
                        const liveItem = currentItems.find(i => i.handle === item.handle);
                        if (liveItem) {
                            liveItem.nicotine = nicotine;
                            liveItem.fetchingNicotine = false;
                            // Save and Render
                            DB.saveAdminExtras(currentItems).then(() => {
                                // Optimistic Render? Or just let next render handle it?
                                // Better to re-render to show the data
                                this.renderAdminDashboard(elements, DB, showConfirm, this.renderAdminDashboard, Cart, Search);
                            });
                        }
                    }
                });
            }
        });

        const listHtml = cartItems.map((item, index) => {
            // Price Parsing
            let userPrice = 0;
            if (typeof item.price === 'string') {
                userPrice = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            } else {
                userPrice = item.price || 0;
            }

            let origPrice = 0;
            if (item.originalPrice) {
                origPrice = parseFloat(String(item.originalPrice).replace(',', '.'));
            } else if (item.mean) {
                origPrice = item.mean;
            } else {
                origPrice = userPrice;
            }

            const q = item.quantity || 1;
            totalSelling += userPrice * q;
            totalBuying += origPrice * q;

            const userPriceStr = userPrice.toFixed(2).replace('.', ',') + ' €';
            const origPriceStr = origPrice.toFixed(2).replace('.', ',') + ' €';

            // Nicotine Badge
            const nicoBadge = item.nicotine ? `<span style="background:rgba(255,100,100,0.2); color:#ffdddd; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:10px;">${item.nicotine}</span>` : (item.fetchingNicotine ? '<span style="color:#666; font-size:0.8em; margin-left:8px;">(Lade...)</span>' : '');

            // Name / Link
            let nameDisplay = item.name;
            if (item.handle) {
                const url = `https://snuzone.com/products/${item.handle}`;
                nameDisplay = `<a href="${url}" target="_blank" style="color:var(--text-color); text-decoration:none; border-bottom:1px dotted #666;">${item.name}</a> ${nicoBadge}`;
            } else {
                nameDisplay += ` ${nicoBadge}`;
            }

            return `
                <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); padding:15px; border-radius:8px; margin-bottom:10px;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:1.1em; margin-bottom:4px;">${nameDisplay}</div>
                        <div style="font-size:0.9em; color:#888;">
                            <span style="margin-right:15px;">Einkauf: ${origPriceStr}</span>
                            <span style="color:var(--primary-color);">Verkauf: ${userPriceStr}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="display:flex; align-items:center; gap:5px; background:rgba(0,0,0,0.2); padding:5px; border-radius:6px;">
                            <button class="btn btn-secondary btn-sm change-qty" data-index="${index}" data-delta="-1" style="padding:2px 8px;">-</button>
                            <span style="min-width:20px; text-align:center; font-weight:bold;">${q}</span>
                            <button class="btn btn-secondary btn-sm change-qty" data-index="${index}" data-delta="1" style="padding:2px 8px;">+</button>
                        </div>
                        <div style="text-align:right; min-width:80px;">
                            <div style="font-weight:bold;">${(userPrice * q).toFixed(2).replace('.', ',')} €</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const totalProfit = totalSelling - totalBuying;
        const profitColor = totalProfit >= 0 ? '#059669' : '#be123c';

        // Copy Implementation
        const copyToClipboard = () => {
            if (!cartItems || cartItems.length === 0) return;
            // Format: "{quantity}x {Name} {Nicotine} {Price}"
            const lines = cartItems.map(item => {
                let userPriceStr = '';
                if (typeof item.price === 'string') {
                    userPriceStr = item.price;
                } else {
                    userPriceStr = (item.price || 0).toFixed(2).replace('.', ',') + ' €';
                }

                // Ensure nice spacing
                const nico = item.nicotine ? ` ${item.nicotine}` : '';
                return `${item.quantity || 1}x ${item.name}${nico} ${userPriceStr}`;
            });
            const textBlock = lines.join('\n');

            navigator.clipboard.writeText(textBlock).then(() => {
                const btn = wrapper.querySelector('.copy-extras-btn');
                if (btn) {
                    if (btn.dataset.timerId) clearTimeout(parseInt(btn.dataset.timerId));

                    btn.innerHTML = '&#10003; Kopiert!';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-success'); // Green feedback

                    const timerId = setTimeout(() => {
                        btn.innerHTML = 'Extras kopieren';
                        btn.classList.remove('btn-success');
                        btn.classList.add('btn-primary');
                        delete btn.dataset.timerId;
                    }, 2000);
                    btn.dataset.timerId = timerId.toString();
                }
            }).catch(err => {
                console.error('Copy failed', err);
                alert('Kopieren fehlgeschlagen: ' + err);
            });
        };

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:20px;">
                    <h2 style="margin:0;">Extras</h2>
                    ${cartItems.length > 0 ? `<button class="btn btn-primary btn-sm copy-extras-btn" style="min-width:140px;">Extras kopieren</button>` : ''}
                </div>
                
                ${cartItems.length === 0 ? '<div style="text-align:center; padding:40px; color:gray; background:rgba(255,255,255,0.02); border-radius:12px;">Keine Extras vorhanden. Suche Produkte um sie hinzuzufügen.</div>' : listHtml}

                ${cartItems.length > 0 ? `
                <div style="margin-top:20px; background:rgba(0,0,0,0.2); padding:20px; border-radius:12px; border:1px solid var(--glass-border);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="color:#888;">Einkaufspreis Total:</span>
                        <span>${totalBuying.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:1.2em; font-weight:bold;">
                        <span>Verkaufspreis Total:</span>
                        <span style="color:var(--primary-color);">${totalSelling.toFixed(2).replace('.', ',')} €</span>
                    </div>
                     <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                        <span>Gewinn:</span>
                        <span style="color:${profitColor}; font-weight:bold;">${totalProfit.toFixed(2).replace('.', ',')} €</span>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        container.appendChild(wrapper);

        // Handlers
        const copyBtn = wrapper.querySelector('.copy-extras-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', copyToClipboard);
        }

        wrapper.addEventListener('click', (e) => {
            const btn = e.target.closest('.change-qty');
            if (btn) {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const delta = parseInt(btn.dataset.delta);

                // OPTIMISTIC UPDATE (Mirroring User Cart Logic)
                // 1. Modify State Directly
                const items = DB.state.adminExtras || [];
                const item = items[idx];

                if (item) {
                    item.quantity = (item.quantity || 1) + delta;

                    if (item.quantity <= 0) {
                        items.splice(idx, 1);
                    }

                    // 2. Render Immediately (No Wait)
                    // Use 'this.renderAdminDashboard' to ensure context is preserved
                    this.renderAdminDashboard(elements, DB, showConfirm, this.renderAdminDashboard, Cart, Search);

                    // 3. Save in Background
                    DB.saveAdminExtras(items).catch(err => {
                        console.error('Background Save Failed', err);
                        alert('Warnung: Speichern fehlgeschlagen. ' + (err.message || JSON.stringify(err)));
                    });
                }
            }
        });
    },

    setupUserHandlers(content, DB, elements, showConfirm, selfRender, showAdminModal, cartHelper, Search) {
        const createBtn = content.querySelector('#create-user-btn');
        if (createBtn) createBtn.onclick = async () => {
            const u = content.querySelector('#new-user-name').value.trim();
            const p = content.querySelector('#new-user-pass').value.trim();
            if (u && p) {
                try { await DB.createUser(u, p); selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search); }
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
                    setTimeout(() => selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search), 50);
                } catch (e) {
                    CoreUI.showModal('Fehler', 'Speichern fehlgeschlagen.');
                }
            });
        };

        content.querySelectorAll('.role-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'admin'));
        content.querySelectorAll('.pablo-checkbox').forEach(c => c.onclick = (e) => safeRoleHandler(e, 'pablo'));

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
                        selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search);
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
                        selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search);
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
                selfRender(elements, DB, showConfirm, selfRender, cartHelper, Search);
            };
        });
    }
};

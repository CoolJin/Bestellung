// --- js/modules/ui/admin.js ---
// RESTORED FROM LIVE SITE (cooljin.github.io)
import { OrdersUI } from './orders.js';

export const AdminUI = {
    renderAdminDashboard(elements, DB, showConfirm, selfRender, Cart, Search) {
        const container = elements.ordersList;
        if (!container) return;

        const activeTab = container.dataset.activeTab || 'orders'; // Default was 'orders' on live site

        container.innerHTML = '';
        container.classList.remove('hidden');

        // Render Tabs Logic (Enhanced with Search/Extras)
        if (activeTab === 'orders') {
            this.renderAdminOrders(container, DB, showConfirm, Cart, selfRender);
        } else if (activeTab === 'users') {
            this.renderAdminUsers(container, DB, showConfirm, selfRender);
        } else if (activeTab === 'search') {
            this.renderAdminSearch(container, elements, window.app.state, Cart, Search, selfRender, DB, showConfirm);
        } else if (activeTab === 'extras') {
            this.renderAdminExtras(container, window.app.state, selfRender, DB, Cart, Search, showConfirm, elements);
        }
    },

    // --- 1. SEARCH TAB (New Feature) ---
    renderAdminSearch(container, elements, state, Cart, Search, selfRender, DB, showConfirm) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="header-actions">
                <h2>Produktsuche</h2>
                <div class="search-wrapper" style="max-width:400px;">
                    <span class="search-icon">&#128269;</span>
                    <input type="text" id="admin-snuzone-search" placeholder="Suche..." class="search-input">
                    <button id="admin-search-clear" class="search-clear">✕</button>
                </div>
            </div>
            <div id="admin-search-results" class="product-grid" style="margin-top:20px;">
                <div style="grid-column:1/-1; text-align:center; color:gray; padding:20px;">Suche starten...</div>
            </div>
        `;
        container.appendChild(wrapper);

        const input = wrapper.querySelector('#admin-snuzone-search');
        const clearBtn = wrapper.querySelector('#admin-search-clear');
        const grid = wrapper.querySelector('#admin-search-results');

        const proxyElements = {
            ...elements,
            snuzoneSearch: input,
            snuzoneResultsGrid: grid
        };

        const addToExtras = (product, qty, st, cb) => {
            Cart.addToCartLogic(product, st, () => {
                if (cb) cb();
            });
        };

        if (Search && input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    Search.handleSearch(input.value, proxyElements, addToExtras);
                }
            });
            clearBtn.addEventListener('click', () => {
                input.value = '';
                grid.innerHTML = '';
            });
        }
    },

    // --- 2. EXTRAS TAB (New Feature) ---
    renderAdminExtras(container, state, selfRender, DB, Cart, Search, showConfirm, elements) {
        const cartItems = state.cart || [];
        const total = cartItems.reduce((acc, item) => {
            let price = 0;
            if (typeof item.price === 'string') {
                price = parseFloat(item.price.replace('€', '').replace(',', '.').trim()) || 0;
            } else {
                price = item.price || 0;
            }
            return acc + (price * (item.quantity || 1));
        }, 0);

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="header-actions">
                <h2>Extras (Warenkorb)</h2>
                <div style="font-weight:600; color:var(--primary-color); font-size:1.2em;">
                    Gesamt: ${total.toFixed(2).replace('.', ',')} €
                </div>
            </div>
            <div id="admin-extras-list" style="margin-top:1rem;"></div>
        `;
        container.appendChild(wrapper);

        const list = wrapper.querySelector('#admin-extras-list');
        if (cartItems.length === 0) {
            list.innerHTML = '<p class="text-muted" style="text-align:center; padding:20px;">Keine Extras ausgewählt.</p>';
        } else {
            cartItems.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'cart-item';
                row.innerHTML = `
                    <div style="flex:1">
                        <b>${item.name}</b>
                        <br><small class="text-muted">${item.price}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="btn btn-secondary btn-sm change-qty" data-index="${index}" data-delta="-1">-</button>
                        <span>${item.quantity || 1}</span>
                        <button class="btn btn-secondary btn-sm change-qty" data-index="${index}" data-delta="1">+</button>
                    </div>
                `;
                list.appendChild(row);
            });

            list.addEventListener('click', (e) => {
                const btn = e.target.closest('.change-qty');
                if (btn) {
                    const idx = parseInt(btn.dataset.index);
                    const delta = parseInt(btn.dataset.delta);
                    Cart.changeCartQty(idx, delta, state, () => {
                        selfRender(elements, DB, showConfirm, selfRender, Cart, Search);
                    }, () => { });
                }
            });
        }
    },

    // --- 3. ORDERS TAB (Restored Logic) ---
    renderAdminOrders(container, DB, showConfirm, Cart, selfRender) {
        container.innerHTML = '<h2>Bestellungen</h2><div id="admin-orders-container" style="margin-top:1rem; display:flex; flex-direction:column; gap:10px;"></div>';
        const inner = container.querySelector('#admin-orders-container');
        const orders = DB.getOrders().sort((a, b) => new Date(b.date) - new Date(a.date));

        const openOrders = orders.filter(o => o.status === 'open' || o.status === 'captured');
        const closedOrders = orders.filter(o => o.status === 'done' || o.status === 'completed');
        const cancelledOrders = orders.filter(o => o.status === 'cancelled');

        // Using OrdersUI.createCollapsible as seen in Live Site (inferred from browser check)
        inner.appendChild(OrdersUI.createCollapsible('Offene Bestellungen', openOrders, false, true, 'open'));
        inner.appendChild(OrdersUI.createCollapsible('Abgeschlossene', closedOrders, true, false, 'done'));
        inner.appendChild(OrdersUI.createCollapsible('Storniert', cancelledOrders, true, false, 'cancelled'));

        // Re-attach listeners for Admin Actions
        inner.addEventListener('click', (e) => {
            const t = e.target;
            const id = t.dataset.id;
            if (!id) return;

            // "Abgeschlossen" / Archive
            if (t.classList.contains('archive-order')) {
                DB.updateOrder(id, o => o.status = 'done');
                selfRender(window.app.elements, DB, showConfirm, selfRender, Cart, window.Search);
            }
            // "Löschen"
            if (t.classList.contains('delete-order')) {
                showConfirm('Löschen?', 'Wirklich löschen?', () => {
                    DB.deleteOrder(id);
                    selfRender(window.app.elements, DB, showConfirm, selfRender, Cart, window.Search);
                });
            }
            // "Wiederherstellen"
            if (t.classList.contains('restore-order')) {
                DB.updateOrder(id, o => o.status = 'open');
                selfRender(window.app.elements, DB, showConfirm, selfRender, Cart, window.Search);
            }
            // "Erneut bestellen" -> Revive
            if (t.classList.contains('revive-order')) {
                DB.updateOrder(id, o => {
                    o.status = 'open';
                    o.deletedByAdmin = false;
                });
                selfRender(window.app.elements, DB, showConfirm, selfRender, Cart, window.Search);
            }
        });
    },

    // --- 4. USERS TAB (Restored Logic) ---
    renderAdminUsers(container, DB, showConfirm, selfRender) {
        container.innerHTML = '<h2>Benutzerverwaltung</h2><div id="admin-users-table" style="margin-top:1rem;"></div>';
        const inner = container.querySelector('#admin-users-table');
        const users = DB.getUsers();

        const table = document.createElement('table');
        table.className = 'table glass-panel'; // Added glass-panel based on user style preference
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="text-align:left; padding:10px;">Name</th>
                    <th style="text-align:left; padding:10px;">Rolle</th>
                    <th style="padding:10px; text-align:right;">Aktion</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            tr.innerHTML = `
                <td style="padding:10px;">${u.username}</td>
                <td style="padding:10px;">${u.role}</td>
                <td style="padding:10px; text-align:right;">
                    ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm delete-user" data-user="${u.username}">Löschen</button>` : '<span class="text-muted" style="font-size:0.8em">Admin</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
        inner.appendChild(table);

        inner.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-user')) {
                const u = e.target.dataset.user;
                showConfirm('Benutzer löschen?', `Benutzer ${u} löschen?`, async () => {
                    await DB.deleteUser(u);
                    selfRender(window.app.elements, DB, showConfirm, selfRender, null, null);
                });
            }
        });
    }
};

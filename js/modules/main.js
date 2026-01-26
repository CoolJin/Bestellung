import { Auth } from './auth.js';
import { Search } from './search.js';
import { Cart } from './cart.js';
import { UI } from './ui.js';
import { DB } from '../db.js';

window.app = {
    views: {},
    elements: {},
    state: {
        currentUser: null,
        cart: [],
        products: [],
        editingOrderId: null
    },
    currentView: 'login',

    async init() {
        const log = (msg) => { console.log(msg); };

        log('Loading DB...');
        try {
            // Timeout Logic for DB Init (5 seconds)
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Datenbank-Verbindung Zeitüberschreitung. Prüfen Sie Internet/Adblocker.')), 5000));

            await Promise.race([DB.init(), timeoutPromise]);

            // SYNC PRODUCTS from DB to App State
            this.state.products = DB.state.products || [];

            log('DB Init Done');
        } catch (e) {
            console.error('Startup Error:', e);
            document.body.innerHTML = `<div style="color:white; padding:20px; text-align:center;">
                <h1>Fehler beim Starten</h1>
                <p>Verbindung fehlgeschlagen. Bitte neu laden.</p>
                <button onclick="location.reload()" style="padding:10px; margin-top:20px;">Neu laden</button>
            </div>`;
            return;
        }

        log('Initializing Logic...');
        this.views = {
            login: document.getElementById('login-view'),
            catalog: document.getElementById('catalog-view'),
            cart: document.getElementById('cart-view'),
            admin: document.getElementById('admin-dashboard-view'),
            profile: document.getElementById('profile-view')
        };

        if (!document.getElementById('toast-container')) {
            const tc = document.createElement('div');
            tc.id = 'toast-container';
            document.body.appendChild(tc);
        }

        this.elements = {
            loginForm: document.getElementById('login-form'),
            productGrid: document.getElementById('product-grid'),
            checkoutBtn: document.getElementById('checkout-btn'),
            snuzoneSearch: document.getElementById('snuzone-search'),
            searchClear: document.getElementById('search-clear-btn'),
            searchFeedback: document.getElementById('search-feedback'),
            snuzoneResultsGrid: document.getElementById('snuzone-results-grid'),
            cartCount: document.getElementById('cart-count'),
            cartItems: document.getElementById('cart-items'),
            cartTotal: document.getElementById('cart-total'),
            loginError: document.getElementById('login-error'),
            adminMsg: document.getElementById('admin-msg'),
            ordersList: document.getElementById('orders-list'),
            profileOrdersList: document.getElementById('profile-orders-list'),
            newUsername: document.getElementById('new-username'),
            newPassword: document.getElementById('new-password'),
            orderNote: document.getElementById('order-note'),
            logoutModal: document.getElementById('logout-modal'),
            logoutConfirm: document.getElementById('logout-confirm'),
            logoutCancel: document.getElementById('logout-cancel'),
            menuToggle: document.getElementById('menu-toggle'),
            navContainer: document.getElementById('main-nav')
        };
        log('Elements captured');

        // Initialize Search
        Search.init(this.state, this.elements, Cart.addToCartLogic.bind(Cart));
        log('Search initialized');

        this.setupEventListeners();
        log('Listeners setup');

        Auth.checkSession(DB, this.state, () => this.updateUI(), (v) => this.navigateTo(v), this.currentView);
        log('Session checked');

        console.log('App Initialized (Modular)');
    },

    updateUI() {
        this.renderNav();
    },

    navigateTo(viewName) {
        if (viewName === 'admin-dashboard') viewName = 'admin';
        this.currentView = viewName;

        Object.values(this.views).forEach(el => el && el.classList.add('hidden'));
        if (this.views[viewName]) this.views[viewName].classList.remove('hidden');

        if (viewName === 'catalog') UI.renderCatalog(this.elements, this.state);
        if (viewName === 'cart') UI.renderCart(this.elements, this.state, this.changeCartQty.bind(this));
        if (viewName === 'admin') UI.renderAdminDashboard(this.elements, DB, UI.showConfirm, UI.renderAdminDashboard);
        // Pass Cart to ProfileUI for Dynamic Pricing Calculation (Dependency Injection)
        if (viewName === 'profile') UI.renderProfile(this.elements, DB, this.state, Cart);

        this.renderNav();
    },

    renderNav() {
        if (!this.elements.navContainer) return;
        this.elements.navContainer.innerHTML = '';
        if (!this.state.currentUser) return;

        const createLink = (text, view, cls = '', tab = '') => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = text;
            a.className = 'nav-link ' + cls;
            a.dataset.view = view;
            if (tab) a.dataset.tab = tab;

            const currentTab = this.elements.ordersList ? (this.elements.ordersList.dataset.activeTab || 'orders') : 'orders';
            const isActiveView = view === this.currentView;
            // Admin Tab & Active Logic
            if (view === 'admin' && this.currentView === 'admin') {
                if (tab === currentTab) a.classList.add('active');
            } else if (isActiveView && view !== 'admin' && view !== 'logout') {
                a.classList.add('active');
            }

            this.elements.navContainer.appendChild(a);
        };

        if (this.state.currentUser.role === 'user') {
            createLink('Suchen', 'catalog');
            createLink('Warenkorb', 'cart');
            createLink('Profil', 'profile');
            createLink('Abmelden', 'logout', 'btn-danger');
        } else if (this.state.currentUser.role === 'admin') {
            createLink('Bestellungen', 'admin', '', 'orders');
            createLink('Benutzer', 'admin', '', 'users');
            createLink('Abmelden', 'logout', 'btn-danger');
        }
    },

    setupEventListeners() {
        const safeAdd = (el, event, handler) => { if (el) el.addEventListener(event, handler); };

        safeAdd(this.elements.menuToggle, 'click', () => this.elements.navContainer.classList.toggle('show'));

        safeAdd(this.elements.loginForm, 'submit', (e) => {
            e.preventDefault();
            Auth.login(e.target.username.value, e.target.password.value, DB, this.state, (v) => this.navigateTo(v), () => this.updateUI(), this.elements);
        });

        if (this.elements.navContainer) {
            this.elements.navContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-link')) {
                    e.preventDefault();
                    const targetView = e.target.dataset.view;
                    const targetTab = e.target.dataset.tab;

                    if (targetTab && this.elements.ordersList) {
                        this.elements.ordersList.dataset.activeTab = targetTab;
                        if (targetTab === 'orders') this.elements.ordersList.dataset.selectedUser = '';
                        window.dispatchEvent(new CustomEvent('admin-tab-changed', { detail: { tab: targetTab } }));
                    }

                    if (targetView === 'logout') {
                        this.elements.logoutModal.classList.remove('hidden');
                    } else {
                        this.navigateTo(targetView);
                    }
                    this.elements.navContainer.classList.remove('show');
                }
            });
        }

        // Search Handlers (Uses Search Module)
        safeAdd(this.elements.searchClear, 'click', () => {
            if (this.elements.snuzoneSearch) {
                this.elements.snuzoneSearch.value = '';
                // Must explicitly call handleSearch with empty string to reset the grid
                Search.handleSearch('', this.elements, Cart.addToCartLogic.bind(Cart));
            }
        });

        // Ensure Enter Key works manually if the module missed it?
        safeAdd(this.elements.snuzoneSearch, 'keypress', (e) => {
            if (e.key === 'Enter') {
                Search.handleSearch(e.target.value.trim(), this.elements, Cart.addToCartLogic.bind(Cart));
            }
        });

        safeAdd(this.elements.snuzoneResultsGrid, 'click', (e) => {
            // Handled inside Search.renderSearchResults usually, but safe fallback?
            // Actually Search.js attaches handlers to buttons on render.
            // But we keep this if Search.js doesn't.
            // Search.js DOES attach handlers.
        });

        safeAdd(this.elements.checkoutBtn, 'click', () => Cart.placeOrder(this.state, DB, this.elements, () => Cart.updateCartCount(this.state, this.elements), (v) => this.navigateTo(v)));

        // Profile & Admin Actions (Delegate)
        safeAdd(this.elements.profileOrdersList, 'click', (e) => this.handleProfileAction(e));

        // Logout Modal
        safeAdd(this.elements.logoutConfirm, 'click', () => {
            this.elements.logoutModal.classList.add('hidden');
            Auth.logout(DB, this.state, (v) => this.navigateTo(v), () => this.updateUI());
        });
        safeAdd(this.elements.logoutCancel, 'click', () => this.elements.logoutModal.classList.add('hidden'));

        window.addEventListener('click', () => DB.updateSessionActivity());
        window.addEventListener('keypress', () => DB.updateSessionActivity());
    },

    changeCartQty(index, delta) {
        Cart.changeCartQty(index, delta, this.state, () => UI.renderCart(this.elements, this.state, this.changeCartQty.bind(this)), () => Cart.updateCartCount(this.state, this.elements));
    },

    handleProfileAction(e) {
        const id = e.target.dataset.id;
        if (!id) return;
        const cls = e.target.classList;

        if (cls.contains('cancel-order')) {
            UI.showConfirm('Bestellung stornieren?', 'Möchten Sie diese Bestellung wirklich stornieren?', () => {
                DB.updateOrder(id, o => o.status = 'cancelled');
                // Pass Cart for pricing!
                UI.renderProfile(this.elements, DB, this.state, Cart);
            });
        }
        if (cls.contains('archive-order')) {
            DB.updateOrder(id, o => { if (!o.archivedBy) o.archivedBy = []; o.archivedBy.push(this.state.currentUser.username); });
            UI.renderProfile(this.elements, DB, this.state, Cart);
        }
        if (cls.contains('restore-order')) {
            DB.updateOrder(id, o => { if (o.archivedBy) o.archivedBy = o.archivedBy.filter(u => u !== this.state.currentUser.username); });
            UI.renderProfile(this.elements, DB, this.state, Cart);
        }
        if (cls.contains('revive-order')) {
            DB.updateOrder(id, o => {
                o.status = 'open';
                o.deletedByAdmin = false;
                if (o.archivedBy) o.archivedBy = o.archivedBy.filter(u => u !== this.state.currentUser.username);
            });
            UI.renderProfile(this.elements, DB, this.state, Cart);
        }
        if (cls.contains('delete-order')) {
            UI.showConfirm('Bestellung löschen?', 'Möchten Sie den Eintrag endgültig entfernen?', () => {
                DB.deleteOrder(id);
                UI.renderProfile(this.elements, DB, this.state, Cart);
            });
        }
        if (cls.contains('edit-order')) {
            const orders = DB.getOrders();
            const o = orders.find(x => x.id === id);
            if (o) {
                UI.showConfirm('Bestellung bearbeiten?', 'Der aktuelle Warenkorb wird überschrieben. Fortfahren?', () => {
                    this.state.editingOrderId = o.id;
                    o.items.forEach(i => Cart.addToCartLogic(i, this.state, () => Cart.updateCartCount(this.state, this.elements)));

                    if (o.note && this.elements.orderNote) {
                        this.elements.orderNote.value = o.note;
                    }

                    // Keep order until saved? Or delete?
                    // Original logic deleted it.
                    DB.deleteOrder(id);
                    this.navigateTo('cart');
                    UI.showModal('Bestellung bearbeitet', 'Inhalte geladen');
                });
            }
        }
    }
};



// Immediate Execution (Module is deferred automatically)
console.log('Main Module Loaded');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.app.init());
} else {
    window.app.init();
}

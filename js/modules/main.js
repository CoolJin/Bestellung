// --- js/modules/main.js ---
import { Auth } from './auth.js';
import { Search } from './search.js';
import { Cart } from './cart.js';
import { UI } from './ui.js';

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

    init() {
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

        this.setupEventListeners();
        Auth.checkSession(DB, this.state, () => this.updateUI(), (v) => this.navigateTo(v), this.currentView);

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
        if (viewName === 'admin') UI.renderAdminDashboard(this.elements, DB, UI.showConfirm, UI.renderAdminDashboard); // Pass self render
        if (viewName === 'profile') UI.renderProfile(this.elements, DB, this.state);

        this.renderNav();
    },

    renderNav() {
        if (!this.elements.navContainer) return;
        this.elements.navContainer.innerHTML = '';
        if (!this.state.currentUser) return;

        const createLink = (text, view, cls = '') => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = text;
            a.className = 'nav-link ' + cls;
            a.dataset.view = view;
            if (view === this.currentView && view !== 'logout') a.classList.add('active');
            this.elements.navContainer.appendChild(a);
        };

        if (this.state.currentUser.role === 'user') {
            createLink('Suchen', 'catalog');
            createLink('Warenkorb', 'cart');
            createLink('Profil', 'profile');
        } else if (this.state.currentUser.role === 'admin') {
            createLink('Dashboard', 'admin');
        }
        createLink('Abmelden', 'logout', 'btn-danger');
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
                    if (targetView === 'logout') {
                        this.elements.logoutModal.classList.remove('hidden');
                    } else {
                        this.navigateTo(targetView);
                    }
                    this.elements.navContainer.classList.remove('show');
                }
            });
        }

        safeAdd(this.elements.productGrid, 'click', (e) => {
            if (e.target.classList.contains('add-to-cart')) {
                Cart.addToCart(e.target.dataset.id, 1, this.state, () => Cart.updateCartCount(this.state, this.elements));
            }
        });

        // Search
        safeAdd(this.elements.snuzoneSearch, 'keypress', (e) => { if (e.key === 'Enter') Search.handleSearch(this.elements.snuzoneSearch.value.trim(), this.elements, (p) => UI.renderSearchResults(p, this.elements), (els) => Search.clearSearch(els)); });
        safeAdd(this.elements.searchClear, 'click', () => Search.clearSearch(this.elements));

        safeAdd(this.elements.snuzoneResultsGrid, 'click', (e) => {
            if (e.target.classList.contains('add-external')) {
                const idx = e.target.dataset.index;
                Cart.addToCartLogic(Search.results[idx], this.state, () => Cart.updateCartCount(this.state, this.elements));
                document.getElementById('search-results').classList.add('hidden');
            }
        });

        safeAdd(this.elements.checkoutBtn, 'click', () => Cart.placeOrder(this.state, DB, this.elements, () => Cart.updateCartCount(this.state, this.elements), (v) => this.navigateTo(v)));

        // Profile Actions
        safeAdd(this.elements.profileOrdersList, 'click', (e) => this.handleProfileAction(e));

        // Admin Actions
        safeAdd(this.elements.ordersList, 'click', (e) => {
            if (e.target.classList.contains('delete-order')) {
                const id = e.target.dataset.id;
                UI.showConfirm('Bestellung löschen?', `Möchten Sie Bestellung ${id} wirklich löschen?`, () => {
                    DB.deleteOrder(id);
                    UI.renderAdminDashboard(this.elements, DB, UI.showConfirm);
                });
            }
        });

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
                UI.renderProfile(this.elements, DB, this.state);
            });
        }
        if (cls.contains('archive-order')) {
            DB.updateOrder(id, o => { if (!o.archivedBy) o.archivedBy = []; o.archivedBy.push(this.state.currentUser.username); });
            UI.renderProfile(this.elements, DB, this.state);
        }
        if (cls.contains('restore-order')) {
            DB.updateOrder(id, o => { if (o.archivedBy) o.archivedBy = o.archivedBy.filter(u => u !== this.state.currentUser.username); });
            UI.renderProfile(this.elements, DB, this.state);
        }
        if (cls.contains('delete-order')) {
            UI.showConfirm('Bestellung löschen?', 'Möchten Sie den Eintrag endgültig entfernen?', () => {
                DB.deleteOrder(id);
                UI.renderProfile(this.elements, DB, this.state);
            });
        }
        if (cls.contains('edit-order')) {
            const orders = DB.getOrders();
            const o = orders.find(x => x.id === id);
            if (o) {
                this.state.editingOrderId = o.id;
                o.items.forEach(i => Cart.addToCartLogic(i, this.state, () => Cart.updateCartCount(this.state, this.elements)));
                DB.deleteOrder(id);
                this.navigateTo('cart');
                UI.showModal('Bestellung bearbeitet', 'Inhalte geladen');
            }
        }
    }
};

window.onload = () => window.app.init();

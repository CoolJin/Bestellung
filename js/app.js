// Placeholder to facilitate view_file. I will view index.html next.

// --- Initialization ---
function init() {
    // Initialize DOM elements safely after load
    views = {
        login: document.getElementById('login-view'),
        catalog: document.getElementById('catalog-view'),
        cart: document.getElementById('cart-view'),
        admin: document.getElementById('admin-dashboard-view'),
        profile: document.getElementById('profile-view')
    };

    // Create Toast Container
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div');
        tc.id = 'toast-container';
        document.body.appendChild(tc);
    }

    navContainer = document.getElementById('main-nav');
    menuToggle = document.getElementById('menu-toggle');

    // Store other elements safely
    elements = {
        loginForm: document.getElementById('login-form'),
        productGrid: document.getElementById('product-grid'),
        cartSummaryBtn: document.getElementById('cart-summary-btn'),
        backToCatalogBtn: document.getElementById('back-to-catalog'),
        checkoutBtn: document.getElementById('checkout-btn'),
        createUserForm: document.getElementById('create-user-form'),
        // searchBtn removed from HTML
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
        // Modals
        logoutModal: document.getElementById('logout-modal'),
        logoutConfirm: document.getElementById('logout-confirm'),
        logoutCancel: document.getElementById('logout-cancel')
    };

    console.log('App Initialized', { views, elements });

    initAuth();
    setupEventListeners();
    checkSession();
}

function setupEventListeners() {
    const safeAdd = (el, event, handler) => {
        if (el) el.addEventListener(event, handler);
    };

    safeAdd(menuToggle, 'click', () => navContainer.classList.toggle('show'));

    safeAdd(elements.loginForm, 'submit', (e) => {
        e.preventDefault();
        login(e.target.username.value, e.target.password.value);
    });

    if (navContainer) {
        navContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link')) {
                e.preventDefault();
                const targetView = e.target.dataset.view;
                if (targetView === 'logout') {
                    // Direct logout as requested (or confirm? keeping basic)
                    // User reverted logout button to standard.
                    // confirmLogout(); 
                    // Let's just logout directly or keep modal?
                    // User didn't explicitly ask to remove modal, just "standard button".
                    // I'll keep the modal to be safe, it's premium.
                    confirmLogout();
                } else {
                    navigateTo(targetView);
                }
                navContainer.classList.remove('show');
            }
        });
    }

    safeAdd(elements.productGrid, 'click', (e) => {
        if (e.target.classList.contains('add-to-cart')) {
            addToCart(e.target.dataset.id);
        }
    });

    safeAdd(elements.cartSummaryBtn, 'click', () => navigateTo('cart'));
    safeAdd(elements.backToCatalogBtn, 'click', () => navigateTo('catalog'));
    safeAdd(elements.checkoutBtn, 'click', placeOrder);

    // Admin
    safeAdd(elements.createUserForm, 'submit', handleCreateUser);

    // Admin Actions Delegation
    safeAdd(elements.ordersList, 'click', handleAdminAction);

    // Profile Actions Delegation
    safeAdd(elements.profileOrdersList, 'click', handleProfileAction);

    // Search
    safeAdd(elements.snuzoneSearch, 'keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    safeAdd(elements.searchClear, 'click', handleClearSearch);

    safeAdd(elements.snuzoneResultsGrid, 'click', (e) => {
        if (e.target.classList.contains('add-external')) {
            addExternalToCart(e.target.dataset.index);
        }
    });

    // Modal
    safeAdd(elements.logoutConfirm, 'click', () => {
        elements.logoutModal.classList.add('hidden');
        logout();
    });
    safeAdd(elements.logoutCancel, 'click', () => elements.logoutModal.classList.add('hidden'));
}

// --- Features ---

function confirmLogout() {
    elements.logoutModal.classList.remove('hidden');
}

// --- State Management ---
const state = {
    currentUser: null,
    cart: [],
    products: []
};

// --- Snuzone Search System ---
let currentSearchResults = [];
let searchController = null; // To cancel previous searches

async function handleSearch() {
    const query = elements.snuzoneSearch.value.trim();
    if (!query) return handleClearSearch();

    const resultsContainer = document.getElementById('search-results');
    const feedback = elements.searchFeedback;
    const grid = elements.snuzoneResultsGrid;

    // Cancel previous search
    if (searchController) {
        searchController.abort();
    }
    searchController = new AbortController();

    // UI Updates
    resultsContainer.classList.remove('hidden');
    feedback.classList.remove('hidden');
    feedback.innerHTML = `<span class="loader"></span> Suche nach "${query}"...`;
    grid.innerHTML = ''; // Clear previous

    try {
        const products = await searchSnuzone(query, searchController.signal);

        // If aborted, this won't be reached usually due to exception, 
        // but if we handle it inside searchSnuzone, check signal.
        if (searchController.signal.aborted) return;

        currentSearchResults = products;

        feedback.classList.add('hidden');
        feedback.innerHTML = ''; // Clear text explicitly
        renderSearchResults(products);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Search aborted');
            return; // Ignore aborts
        }
        console.error('Search error:', error);
        feedback.innerHTML = `<div class="error-message">Fehler: ${error.message}</div>`;
        grid.innerHTML = '';
    } finally {
        // cleanup if this was the active controller
        if (searchController && !searchController.signal.aborted) {
            searchController = null;
        }
    }
}

function handleClearSearch() {
    elements.snuzoneSearch.value = '';
    document.getElementById('search-results').classList.add('hidden');
    if (elements.searchFeedback) elements.searchFeedback.classList.add('hidden');
    elements.snuzoneSearch.focus();
}

async function searchSnuzone(query, signal) {
    const proxies = [
        {
            name: 'CorsProxy',
            url: (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
            extract: async (res) => await res.text()
        },
        // Fallbacks
        {
            name: 'AllOrigins',
            url: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}&t=${Date.now()}`,
            extract: async (res) => {
                const data = await res.json();
                return data.contents;
            }
        }
    ];

    const SEARCH_URL = `https://snuzone.com/search?q=${encodeURIComponent(query)}`;
    let htmlContent = null;
    let usedProxy = null;

    for (const proxy of proxies) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        try {
            console.log(`Trying proxy: ${proxy.name}...`);
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 5000); // 5s timeout for list

            const onAbort = () => timeoutController.abort();
            signal.addEventListener('abort', onAbort);

            try {
                const response = await fetch(proxy.url(SEARCH_URL), { signal: timeoutController.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`Status ${response.status}`);

                htmlContent = await proxy.extract(response);
            } finally {
                clearTimeout(timeoutId);
                signal.removeEventListener('abort', onAbort);
            }

            if (htmlContent && htmlContent.length > 500 && !htmlContent.includes('Just a moment...')) { // Cloudflare check
                usedProxy = proxy;
                break;
            }
        } catch (e) {
            if (signal.aborted) throw e;
            console.warn(`Proxy ${proxy.name} failed:`, e);
        }
    }

    if (!htmlContent) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        throw new Error('Verbindung zu Snuzone fehlgeschlagen.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Limit results to 12
    const links = Array.from(doc.querySelectorAll('a[href*="/products/"]'))
        .map(a => {
            const href = a.getAttribute('href');
            return href.startsWith('http') ? href : `https://snuzone.com${href}`;
        })
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 12); // Limited to 12

    if (links.length === 0) return [];

    const productPromises = links.map(async (url) => {
        if (signal.aborted) return null;
        try {
            const timeoutController = new AbortController();
            const id = setTimeout(() => timeoutController.abort(), 4000); // 4s per product

            const onAbort = () => timeoutController.abort();
            signal.addEventListener('abort', onAbort);

            try {
                const proxyUrl = usedProxy ? usedProxy.url(url) : proxies[0].url(url);
                const pRes = await fetch(proxyUrl, { signal: timeoutController.signal });

                const pContent = await (usedProxy ? usedProxy.extract(pRes) : pRes.text());
                const pDoc = parser.parseFromString(pContent, 'text/html');

                const title = pDoc.querySelector('meta[property="og:title"]')?.content ||
                    pDoc.querySelector('h1')?.textContent?.trim() || 'Unbekanntes Produkt';

                let image = pDoc.querySelector('meta[property="og:image"]')?.content ||
                    pDoc.querySelector('.product__media img')?.src ||
                    'https://placehold.co/400x300?text=No+Image';

                if (image.startsWith('//')) image = 'https:' + image;

                // Flexible Price Parsing
                let price = 0;
                const priceMeta = pDoc.querySelector('meta[property="og:price:amount"]');
                const priceEl = pDoc.querySelector('.price-item--regular, .price-item--sale, .product-price');

                if (priceMeta) {
                    price = parseFloat(priceMeta.content);
                } else if (priceEl) {
                    const txt = priceEl.textContent.trim().replace(/[^0-9,.]/g, '').replace(',', '.');
                    price = parseFloat(txt) || 0;
                }

                // Sold Out Logic
                let isSoldOut = false;
                const addToCartBtn = pDoc.querySelector('button[name="add"], .product-form__submit');
                if (addToCartBtn && (addToCartBtn.disabled || addToCartBtn.textContent.toLowerCase().includes('ausverkauft') || addToCartBtn.textContent.toLowerCase().includes('sold out'))) {
                    isSoldOut = true;
                }
                const availability = pDoc.querySelector('meta[property="og:availability"]');
                if (availability && (availability.content.includes('out of stock') || availability.content.includes('OutOfStock'))) {
                    isSoldOut = true;
                }
                if (!isSoldOut) {
                    const info = pDoc.querySelector('.product-info, .product-meta, .product__info-container');
                    if (info && (info.textContent.toLowerCase().includes('ausverkauft') || info.textContent.toLowerCase().includes('currently unavailable'))) {
                        isSoldOut = true;
                    }
                }

                return {
                    id: 'ext-' + Date.now() + Math.random().toString(36).substr(2, 9),
                    name: title,
                    price: price,
                    image: image,
                    desc: 'Importiert von Snuzone',
                    externalUrl: url,
                    soldOut: isSoldOut
                };

            } finally {
                clearTimeout(id);
                signal.removeEventListener('abort', onAbort);
            }
        } catch (e) {
            // Ignore single product fails
            return null;
        }
    });

    const results = await Promise.all(productPromises);
    return results.filter(p => p !== null);
}

function renderSearchResults(products) {
    const grid = elements.snuzoneResultsGrid;
    if (!grid) return;
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p>Keine Produkte gefunden.</p>';
        return;
    }

    products.forEach((p, index) => {
        // Real sold out status from search
        const isSoldOut = p.soldOut;

        const card = document.createElement('article');
        card.className = `product-card ${isSoldOut ? 'sold-out' : ''}`;
        card.innerHTML = `
            ${isSoldOut ? '<div class="sold-out-badge">Ausverkauft</div>' : ''}
            <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
            <div class="product-info">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-desc">${p.desc}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    ${!isSoldOut ? `
                    <button class="btn btn-primary btn-sm add-external" data-index="${index}">
                        Hinzufügen
                    </button>` : '<button class="btn btn-secondary btn-sm" disabled>N/A</button>'}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function addExternalToCart(index) {
    const product = currentSearchResults[index];
    if (product) {
        const exists = state.products.find(p => p.name === product.name);
        if (!exists) {
            state.products.push(product);
        }
        addToCart(product.id);
        renderCatalog();

        document.getElementById('search-results').classList.add('hidden');
        elements.snuzoneSearch.value = '';
    }
}

// --- Auth System ---
function initAuth() {
    if (!localStorage.getItem('users')) {
        const users = [
            { username: 'admin', password: 'admin123', role: 'admin' },
            { username: 'user', password: 'user123', role: 'user' }
        ];
        localStorage.setItem('users', JSON.stringify(users));
    }
}

function login(username, password) {
    elements.loginError.textContent = '';

    const btn = elements.loginForm.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Lade...';
    btn.disabled = true;

    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;

        let role = 'user';
        if (username === 'admin' && password === 'admin123') role = 'admin';
        else if (username === 'user' && password === 'user123') role = 'user';
        else {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.username === username && u.password === password);
            if (user) role = 'user';
            else {
                elements.loginError.textContent = 'Ungültige Anmeldedaten';
                return;
            }
        }

        state.currentUser = { username, role };
        // Session Start
        localStorage.setItem('session', JSON.stringify({
            user: state.currentUser,
            lastActive: Date.now()
        }));

        navigateTo(role === 'admin' ? 'admin-dashboard' : 'catalog');
        updateUI();
    }, 500);
}

function logout() {
    state.currentUser = null;
    state.cart = [];
    localStorage.removeItem('session');
    navigateTo('login');
    updateUI();
}

function checkSession() {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            const now = Date.now();
            // 15 Minutes = 900,000 ms
            if (now - session.lastActive < 900000) {
                state.currentUser = session.user;
                session.lastActive = now; // Refresh on reload
                localStorage.setItem('session', JSON.stringify(session));

                // Restore View logic could be added here, currently defaulting based on role
                if (state.currentUser.role === 'admin') {
                    // If we were on admin, good.
                    if (currentView === 'login') navigateTo('admin-dashboard');
                } else {
                    if (currentView === 'login') navigateTo('catalog');
                }
                updateUI();
                return;
            } else {
                localStorage.removeItem('session'); // Expired
            }
        } catch (e) {
            localStorage.removeItem('session');
        }
    }
    navigateTo('login');
    updateUI();
}

// Activity Tracking
function updateSessionActivity() {
    if (state.currentUser) {
        const sessionData = localStorage.getItem('session');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            session.lastActive = Date.now();
            localStorage.setItem('session', JSON.stringify(session));
        }
    }
}
window.addEventListener('click', updateSessionActivity);
window.addEventListener('keypress', updateSessionActivity);
window.addEventListener('mousemove', () => {
    // Throttle mousemove? For simple activity, click/key is usually enough, but let's debounce if adding mouse.
    // Leaving out mousemove to strict "interaction" (clicks/typing) to save perf, or simple throttle? 
    // User said "15 mins nothing done".
});

// --- Navigation & Routing ---
function navigateTo(viewName) {
    Object.values(views).forEach(el => el && el.classList.add('hidden'));
    if (views[viewName]) views[viewName].classList.remove('hidden');

    if (viewName === 'catalog') renderCatalog();
    if (viewName === 'cart') renderCart();
    if (viewName === 'admin') renderAdminDashboard();
    if (viewName === 'profile') renderProfile();

    renderNav();
}

function renderNav() {
    navContainer.innerHTML = '';
    if (!state.currentUser) return;

    if (state.currentUser.role === 'user') {
        createNavLink('Katalog', 'catalog');
        createNavLink('Warenkorb', 'cart');
        createNavLink('Profil', 'profile');
    } else if (state.currentUser.role === 'admin') {
        createNavLink('Dashboard', 'admin');
    }
    createNavLink('Abmelden', 'logout', 'btn-danger');
}

function createNavLink(text, view, extraClass = '') {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = text;
    a.className = 'nav-link ' + extraClass;
    a.dataset.view = view;

    const currentView = Object.keys(views).find(key => !views[key].classList.contains('hidden'));
    if (view === currentView && view !== 'logout') a.classList.add('active');

    navContainer.appendChild(a);
}

// --- Catalog System ---
function renderCatalog() {
    const grid = elements.productGrid;
    if (!grid) return;
    grid.innerHTML = '';

    state.products.forEach(p => {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
            <div class="product-info">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-desc">${p.desc}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    <button class="btn btn-primary btn-sm add-to-cart" data-id="${p.id}">
                        In den Einkaufswagen
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    updateCartCount();
}

// --- Modal Notification System ---
function showModal(title, message, onConfirm = null) {
    const existing = document.getElementById('notification-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'notification-modal';

    modal.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-msg">${message}</div>
            <button id="modal-ok-btn" class="btn btn-primary" style="min-width:100px;">OK</button>
        </div>
    `;

    document.body.appendChild(modal);

    const btn = modal.querySelector('#modal-ok-btn');
    btn.focus();

    const close = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    btn.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
}

function showConfirm(title, message, onYes) {
    const existing = document.getElementById('notification-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'notification-modal';

    modal.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-msg">${message}</div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="modal-cancel-btn" class="btn btn-secondary">Abbrechen</button>
                <button id="modal-yes-btn" class="btn btn-primary">Bestätigen</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-cancel-btn').onclick = () => modal.remove();
    modal.querySelector('#modal-yes-btn').onclick = () => {
        modal.remove();
        onYes();
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// --- Cart System (Updated for Quantity) ---
function addToCart(productId) {
    // productId comes from dataset (string) or internal logic. 
    // Ensure we compare strings to support both '1' and 'ext-123'
    const product = state.products.find(p => String(p.id) === String(productId));
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    const existingItem = state.cart.find(item => String(item.id) === String(productId));

    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        // Clone and add quantity
        state.cart.push({ ...product, quantity: 1 });
    }

    updateCartCount();
    showModal('Hinzugefügt', `${product.name} liegt im Warenkorb.`);
}

function updateCartCount() {
    if (elements.cartCount) {
        const totalQty = state.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        elements.cartCount.textContent = totalQty;
    }
}

function renderCart() {
    const container = elements.cartItems;
    if (!container) return;
    container.innerHTML = '';
    let total = 0;

    if (state.cart.length === 0) {
        container.innerHTML = '<p>Ihr Warenkorb ist leer.</p>';
    } else {
        state.cart.forEach((item, index) => {
            const itemTotal = item.price * (item.quantity || 1);
            total += itemTotal;

            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <div style="flex:1">
                    <strong>${item.name}</strong>
                    <div style="font-size:0.9rem; color:var(--text-muted);">${formatPrice(item.price)} / Stk</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px; margin:0 15px;">
                    <button class="btn btn-secondary btn-sm" onclick="changeCartQty(${index}, -1)">-</button>
                    <span style="font-weight:bold; min-width:20px; text-align:center;">${item.quantity || 1}</span>
                    <button class="btn btn-secondary btn-sm" onclick="changeCartQty(${index}, 1)">+</button>
                </div>
                <div style="font-weight:bold;">${formatPrice(itemTotal)}</div>
            `;
            container.appendChild(el);
        });
    }

    if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(total);
}

window.changeCartQty = function (index, delta) {
    const item = state.cart[index];
    if (!item) return;

    item.quantity = (item.quantity || 1) + delta;

    if (item.quantity <= 0) {
        if (confirm(`${item.name} entfernen?`)) {
            state.cart.splice(index, 1);
        } else {
            item.quantity = 1;
        }
    }

    renderCart();
    updateCartCount();
};

function placeOrder() {
    if (state.cart.length === 0) return showModal('Fehler', 'Warenkorb ist leer.');

    const note = elements.orderNote ? elements.orderNote.value : '';

    const orders = JSON.parse(localStorage.getItem('orders') || '[]');

    // Fixed ID Logic:
    // 1. Filter checks for IDs matching pattern #\d+
    // 2. Parse max ID, defaulting to 0
    let maxId = 0;

    orders.forEach(o => {
        // Strip ALL non-digits to be safe, but we specifically look for #xxxx
        const strId = String(o.id);
        if (strId.startsWith('#')) {
            const numPart = parseInt(strId.replace(/\D/g, ''), 10); // Regex strip non-digits
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) { // < 90000 Check to exclude timestamps
                maxId = numPart;
            }
        }
    });

    const newIdNum = maxId + 1;
    // Format: #0001 (4 digits)
    const formattedId = '#' + String(newIdNum).padStart(4, '0');

    const total = state.cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

    const order = {
        id: formattedId,
        user: state.currentUser.username,
        items: JSON.parse(JSON.stringify(state.cart)), // Deep copy with quantities
        total: total,
        date: new Date().toLocaleString('de-DE'),
        status: 'open',
        note: note
    };

    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    state.cart = [];
    if (elements.orderNote) elements.orderNote.value = '';
    updateCartCount();

    showModal('Erfolg', 'Vielen Dank für Ihre Bestellung! Bestellnummer: ' + formattedId, () => {
        navigateTo('catalog');
    });
}

// --- Profile & Orders ---
function renderProfile() {
    const list = elements.profileOrdersList;
    if (!list) return;
    list.innerHTML = '';

    const allOrders = JSON.parse(localStorage.getItem('orders') || '[]')
        .filter(o => o.user === state.currentUser.username)
        // Sort: Newest First (Descending ID)
        .sort((a, b) => {
            const idA = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
            const idB = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
            return idB - idA;
        });

    // Split Active vs Archived
    const activeOrders = allOrders.filter(o => !o.archivedBy?.includes(state.currentUser.username));
    const archivedOrders = allOrders.filter(o => o.archivedBy?.includes(state.currentUser.username));

    // Render Active
    if (activeOrders.length === 0) list.innerHTML = '<p>Keine aktiven Bestellungen.</p>';
    activeOrders.forEach(order => list.appendChild(createOrderCard(order, false)));

    // Render Archived Section
    if (archivedOrders.length > 0) {
        const archiveContainer = document.createElement('div');
        archiveContainer.className = 'archive-container';
        archiveContainer.innerHTML = `
            <div class="archive-header" onclick="toggleArchive(this)">
                <span>Archiv (${archivedOrders.length})</span>
                <span>▼</span>
            </div>
            <div class="archive-list"></div>
        `;
        const archiveList = archiveContainer.querySelector('.archive-list');
        archivedOrders.forEach(order => archiveList.appendChild(createOrderCard(order, true)));
        list.appendChild(archiveContainer);
    }
}

function createOrderCard(order, isArchived) {
    const card = document.createElement('div');
    card.className = 'order-card';

    const isFinal = order.status === 'ordered' || order.status === 'rejected';
    const isOpen = order.status === 'open' || order.status === 'captured';

    let actionButtons = '';

    if (isArchived) {
        actionButtons = `<button class="btn btn-secondary btn-sm restore-order" data-id="${order.id}">Wiederherstellen</button>`;
    } else {
        // Active List
        if (isOpen) {
            actionButtons = `
                <button class="btn btn-primary btn-sm edit-order" data-id="${order.id}">Bearbeiten</button>
             `;
        }

        // Archive only if final
        if (isFinal) {
            actionButtons += `<button class="btn btn-secondary btn-sm archive-order" data-id="${order.id}" style="margin-left:10px;">Archivieren</button>`;
        }
    }

    // Always allow delete for cleanup? or strict?
    // User requested "Delete Completed" before, but logic says Archive.
    // Let's keep a hard Delete for everything as fallback if requested, or stick to Edit/Archive flow.
    // User said: "man sollte sie wieder herausholen [from archive]... aber auch löschen" and "Edit if not finished".
    // Let's add a Delete Icon or similar for archived? Or just "Delete" button.

    if (isArchived) {
        actionButtons += `<button class="btn btn-danger btn-sm delete-order" data-id="${order.id}" style="margin-left:10px;">Löschen</button>`;
    }

    card.innerHTML = `
        <div class="order-header">
            <span>${order.id} <span class="status-badge ${getStatusClass(order.status)}">${getStatusLabel(order.status)}</span></span>
            <span>${order.date}</span>
        </div>
        <div class="order-body">
            <ul>${(order.items || []).map(i => `<li>${i.quantity || 1}x ${i.name}</li>`).join('')}</ul>
            ${order.note ? `<p style="font-style:italic; color:var(--text-muted)">Your Note: ${order.note}</p>` : ''}
            ${order.adminReply ? `<div class="admin-reply-box"><strong>Admin:</strong> ${order.adminReply}</div>` : ''}
            
            <div style="margin-top:1rem; text-align:right;">
                ${actionButtons}
                <div style="margin-top:0.5rem">Gesamt: ${formatPrice(order.total)}</div>
            </div>
        </div>
    `;
    return card;
}

window.toggleArchive = function (header) {
    const list = header.nextElementSibling;
    list.classList.toggle('open');
    header.querySelector('span:last-child').textContent = list.classList.contains('open') ? '▲' : '▼';
};

function handleProfileAction(e) {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('delete-order')) {
        showConfirm('Bestellung löschen', 'Wirklich unwiderruflich löschen?', () => {
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders = orders.filter(o => String(o.id) !== String(id));
            localStorage.setItem('orders', JSON.stringify(orders));
            renderProfile();
        });
    }
    else if (e.target.classList.contains('archive-order')) {
        showConfirm('Archivieren', 'Bestellung ins Archiv verschieben?', () => {
            updateOrder(id, (o) => {
                if (!o.archivedBy) o.archivedBy = [];
                o.archivedBy.push(state.currentUser.username);
            });
        });
    }
    else if (e.target.classList.contains('restore-order')) {
        updateOrder(id, (o) => {
            if (o.archivedBy) {
                o.archivedBy = o.archivedBy.filter(u => u !== state.currentUser.username);
            }
        });
    }
    else if (e.target.classList.contains('edit-order')) {
        showConfirm('Bestellung bearbeiten', 'Bestellung wird aufgelöst und Inhalte zurück in den Warenkorb gelegt.', () => {
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const orderIndex = orders.findIndex(o => String(o.id) === String(id));
            if (orderIndex !== -1) {
                const order = orders[orderIndex];

                // Store ID for reuse with suffix
                state.editingOrderId = order.id;

                // Restore items
                order.items.forEach(oldItem => {
                    const existing = state.cart.find(ci => String(ci.id) === String(oldItem.id));
                    if (existing) {
                        existing.quantity = (existing.quantity || 1) + (oldItem.quantity || 1);
                    } else {
                        state.cart.push(oldItem);
                    }
                });

                if (order.note && elements.orderNote) elements.orderNote.value = order.note;

                // Delete Original
                orders.splice(orderIndex, 1);
                localStorage.setItem('orders', JSON.stringify(orders));

                updateCartCount();
                navigateTo('cart');
                showModal('Bearbeitungsmodus', 'Inhalte geladen. ID wird bei Abschluss beibehalten/aktualisiert.');
            }
        });
    }
}

function placeOrder() {
    if (state.cart.length === 0) return showModal('Fehler', 'Warenkorb ist leer.');

    // Check limit
    if (elements.orderNote.value.length > 100) {
        return showModal('Fehler', 'Notiz ist zu lang (Max. 100 Zeichen).');
    }

    let orders = JSON.parse(localStorage.getItem('orders') || '[]');

    // Generate ID
    let newId;
    if (state.editingOrderId) {
        // Reuse logic: Append 'B' if not present
        let baseId = String(state.editingOrderId);
        if (!baseId.endsWith('B')) {
            newId = baseId + 'B';
        } else {
            newId = baseId; // Keep existing suffix
        }
        state.editingOrderId = null; // Clear
    } else {
        // Strict sequence logic (max ID + 1)
        // Filter out non-numeric/legacy to find max number
        const maxId = orders.reduce((max, o) => {
            const num = parseInt(String(o.id).replace(/\D/g, ''), 10) || 0;
            return num > max ? num : max;
        }, 0);
        newId = '#' + String(maxId + 1).padStart(4, '0');
    }

    const order = {
        id: newId,
        user: state.currentUser.username,
        date: new Date().toLocaleString('de-DE'),
        items: JSON.parse(JSON.stringify(state.cart)), // Deep copy with quantities
        total: state.cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
        status: 'open',
        note: elements.orderNote ? elements.orderNote.value.trim() : '',
        archivedBy: []
    };

    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    state.cart = [];
    if (elements.orderNote) elements.orderNote.value = '';
    updateCartCount();
    navigateTo('profile');
    showModal('Erfolg', `Bestellung ${newId} erfolgreich aufgegeben!`);

    // Refresh admin list if open? Simpler to just notify.
}

function updateOrder(id, mutator) {
    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => String(o.id) === String(id));
    if (order) {
        mutator(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        renderProfile();
    }
}


// --- Admin System ---
function handleAdminAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id || e.target.closest('.order-card').dataset.id;
    if (!id) return;

    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const index = orders.findIndex(o => String(o.id) === String(id));
    if (index === -1) return;
    const order = orders[index];

    if (e.target.classList.contains('claim-order')) {
        order.status = 'captured';
        order.processedBy = state.currentUser.username;
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('set-ordered')) {
        // Can add reply if needed, prompt optional
        // User asked for "Always answer". Let's assume the explicit Reply button handles text, 
        // OR we can popup a modal for the status change if they want to add a note.
        // Simplified: Change Status. User can add reply separately via "Antworten".
        order.status = 'ordered';
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('set-rejected')) {
        // Custom modal without default text
        const reason = prompt("Grund für Ablehnung (optional):", "");
        order.status = 'rejected';
        if (reason) order.adminReply = reason; // Override or append? User implies answering.
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('set-captured')) {
        // Undo
        order.status = 'captured';
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('submit-reply')) {
        const input = e.target.previousElementSibling;
        if (input) {
            order.adminReply = input.value;
            saveAndRenderAdmin(orders);
            showModal('Gesendet', 'Antwort wurde gespeichert.');
        }
    }
}

function saveAndRenderAdmin(orders) {
    localStorage.setItem('orders', JSON.stringify(orders));
    renderAdminDashboard();
}

function renderAdminDashboard() {
    if (state.currentUser?.role !== 'admin') return;

    const ordersList = elements.ordersList;
    if (!ordersList) return;

    // Sort Newest First
    const orders = JSON.parse(localStorage.getItem('orders') || '[]').sort((a, b) => {
        const idA = parseInt(String(a.id).replace(/\D/g, ''), 10) || 0;
        const idB = parseInt(String(b.id).replace(/\D/g, ''), 10) || 0;
        return idB - idA;
    });

    ordersList.innerHTML = '';

    if (orders.length === 0) {
        ordersList.innerHTML = '<p>Keine Bestellungen vorhanden.</p>';
        return;
    }

    orders.forEach(order => {
        const status = order.status || 'open';
        const isFinal = status === 'ordered' || status === 'rejected';

        const card = document.createElement('div');
        card.className = 'order-card';
        card.dataset.id = order.id;

        // Common Reply Input (Available for all except maybe Open)
        const replySection = `
            <div style="margin-top:10px; display:flex; gap:10px;">
                <input type="text" placeholder="Nachricht an Kunden..." style="flex:1; padding:8px; border-radius:8px; border:1px solid #333; background:#000; color:white;">
                <button class="btn btn-secondary btn-sm submit-reply">Senden</button>
            </div>
        `;

        let actionButtons = '';
        if (status === 'open') {
            actionButtons = `<button class="btn btn-primary btn-sm claim-order" data-id="${order.id}">Bearbeiten (Claim)</button>`;
        } else if (status === 'captured') {
            actionButtons = `
                ${replySection}
                <div style="width:100%; display:flex; gap:10px; margin-top:5px;">
                    <button class="btn btn-primary btn-sm set-ordered" style="background:#3b82f6; flex:1;">Bestellt</button>
                    <button class="btn btn-danger btn-sm set-rejected" style="flex:1;">Abgelehnt</button>
                </div>
            `;
        } else if (isFinal) {
            // Undo capability
            actionButtons = `
                ${replySection}
                <div style="margin-top:10px;">
                    <button class="btn btn-secondary btn-sm set-captured" style="width:100%">Status zurücksetzen (Undo)</button>
                </div>
             `;
        }

        card.innerHTML = `
            <div class="order-header">
                <span>${order.id} - ${order.user}</span>
                <span class="status-badge ${getStatusClass(status)}">${getStatusLabel(status)}</span>
            </div>
            <div class="order-body">
                <ul>${(order.items || []).map(i => `<li>${i.quantity || 1}x ${i.name}</li>`).join('')}</ul>
                ${order.note ? `<p style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;"><strong>Kunden-Notiz:</strong> ${order.note}</p>` : ''}
                ${order.adminReply ? `<div class="admin-reply-box"><strong>Deine Antwort:</strong> ${order.adminReply}</div>` : ''}
                
                <div style="margin-top:1rem; text-align:right;">
                   <div style="margin-bottom:1rem; font-weight:bold;">${formatPrice(order.total)}</div>
                   ${actionButtons}
                </div>
            </div>
        `;
        ordersList.appendChild(card);
    });
}

function handleCreateUser(e) {
    e.preventDefault();
    const newUsername = elements.newUsername?.value;
    const newPassword = elements.newPassword?.value;
    const msg = elements.adminMsg;

    if (newUsername && newPassword) {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.find(u => u.username === newUsername)) {
            showModal('Fehler', 'Benutzer existiert bereits!');
            return;
        }

        users.push({ username: newUsername, password: newPassword, role: 'user' });
        localStorage.setItem('users', JSON.stringify(users));

        msg.textContent = `Benutzer ${newUsername} erfolgreich erstellt!`;
        e.target.reset();
        setTimeout(() => msg.textContent = '', 3000);
    }
}

// --- Utils ---
function getStatusClass(status) {
    if (status === 'captured') return 'status-claimed';
    if (status === 'ordered') return 'status-ordered';
    if (status === 'rejected') return 'status-rejected';
    if (status === 'cancelled') return 'status-cancelled';
    return 'status-open';
}

function getStatusLabel(status) {
    if (status === 'captured') return 'In Bearbeitung';
    if (status === 'ordered') return 'Bestellt';
    if (status === 'rejected') return 'Abgelehnt';
    if (status === 'cancelled') return 'Storniert';
    return 'Offen';
}

function formatPrice(price) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
}

// Toast Utility
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Remove on click
    toast.onclick = () => toast.remove();

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Start
document.addEventListener('DOMContentLoaded', init);

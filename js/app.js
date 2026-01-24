// --- DOM Elements ---
let views = {};
let navContainer;
let menuToggle;
let elements = {}; // Container for all other elements

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
        searchBtn: document.getElementById('search-btn'),
        snuzoneSearch: document.getElementById('snuzone-search'),
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
                    confirmLogout(); // New confirmation
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
    safeAdd(elements.searchBtn, 'click', handleSearch);
    safeAdd(elements.snuzoneSearch, 'keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

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

async function handleSearch() {
    const query = elements.snuzoneSearch.value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    const grid = elements.snuzoneResultsGrid;

    resultsContainer.classList.remove('hidden');
    grid.innerHTML = '<div class="loading-spinner">Suche auf Snuzone...</div>';

    try {
        const products = await searchSnuzone(query);
        currentSearchResults = products;
        renderSearchResults(products);
    } catch (error) {
        console.error('Search error:', error);
        grid.innerHTML = `<div class="error-message">Fehler bei der Suche: ${error.message}</div>`;
    }
}

async function searchSnuzone(query) {
    const proxies = [
        {
            name: 'AllOrigins',
            url: (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
            extract: async (res) => {
                const data = await res.json();
                return data.contents;
            }
        },
        {
            name: 'CodeTabs',
            url: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
            extract: async (res) => await res.text()
        }
    ];

    const SEARCH_URL = `https://snuzone.com/search?q=${encodeURIComponent(query)}`;
    let htmlContent = null;
    let usedProxy = null;

    for (const proxy of proxies) {
        try {
            console.log(`Trying proxy: ${proxy.name}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(proxy.url(SEARCH_URL), { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status ${response.status}`);

            htmlContent = await proxy.extract(response);
            if (htmlContent && htmlContent.length > 500) {
                usedProxy = proxy;
                break;
            }
        } catch (e) {
            console.warn(`Proxy ${proxy.name} failed:`, e);
        }
    }

    if (!htmlContent) throw new Error('Verbindung zu Snuzone fehlgeschlagen (Alle Proxies blockiert oder Timeout).');

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const links = Array.from(doc.querySelectorAll('a[href*="/products/"]'))
        .map(a => {
            const href = a.getAttribute('href');
            return href.startsWith('http') ? href : `https://snuzone.com${href}`;
        })
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 15);

    if (links.length === 0) return [];

    const productPromises = links.map(async (url) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 6000);

            const proxyUrl = usedProxy ? usedProxy.url(url) : proxies[0].url(url);
            const pRes = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(id);

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

            // Real Sold Out Detection
            let isSoldOut = false;
            // 1. Check Button
            const addToCartBtn = pDoc.querySelector('button[name="add"], .product-form__submit');
            if (addToCartBtn && (addToCartBtn.disabled || addToCartBtn.textContent.toLowerCase().includes('ausverkauft') || addToCartBtn.textContent.toLowerCase().includes('sold out'))) {
                isSoldOut = true;
            }
            // 2. Check meta availability
            const availability = pDoc.querySelector('meta[property="og:availability"]');
            if (availability && (availability.content.includes('out of stock') || availability.content.includes('OutOfStock'))) {
                isSoldOut = true;
            }
            // 3. Fallback text search
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
        } catch (e) {
            console.warn('Failed to fetch product detail:', url, e);
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
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        state.currentUser = { username: user.username, role: user.role };
        if (elements.loginError) elements.loginError.textContent = '';
        renderNav();

        if (user.role === 'admin') {
            navigateTo('admin');
        } else {
            navigateTo('catalog'); // OR profile? Catalog is standard.
        }
    } else {
        if (elements.loginError) elements.loginError.textContent = 'Ungültige Anmeldedaten.';
    }
}

function logout() {
    state.currentUser = null;
    state.cart = [];
    renderNav();
    navigateTo('login');
}

function checkSession() {
    navigateTo('login');
}

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
    // Remove existing
    const existing = document.getElementById('notification-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'notification-modal';
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
    btn.onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onConfirm) onConfirm();
        }
    };
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
    // If rejected, maybe dim or style differently? For now standard.

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
                ${!isArchived ? `<button class="btn btn-secondary btn-sm archive-order" data-id="${order.id}">Archivieren</button>` : '<span style="color:var(--text-muted)">Archiviert</span>'}
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
    if (e.target.classList.contains('delete-order')) {
        const id = e.target.dataset.id;
        if (confirm('Bestellung wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) {
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            // Strict String filtering
            orders = orders.filter(o => String(o.id) !== String(id));
            localStorage.setItem('orders', JSON.stringify(orders));
            renderProfile();
        }
    } else if (e.target.classList.contains('archive-order')) {
        const id = e.target.dataset.id;
        if (confirm('Bestellung ins Archiv verschieben?')) {
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const order = orders.find(o => String(o.id) === String(id));
            if (order) {
                if (!order.archivedBy) order.archivedBy = [];
                order.archivedBy.push(state.currentUser.username);
                localStorage.setItem('orders', JSON.stringify(orders));
                renderProfile();
            }
        }
    }
}


// --- Admin System ---
function handleAdminAction(e) {
    // Determine ID from button or card wrapper if needed
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id || e.target.closest('.order-card').dataset.id;
    if (!id) return;

    let orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const index = orders.findIndex(o => String(o.id) === String(id));
    if (index === -1) return;

    if (e.target.classList.contains('claim-order')) {
        orders[index].status = 'captured';
        orders[index].processedBy = state.currentUser.username;
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('set-ordered')) {
        orders[index].status = 'ordered';
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('set-rejected')) {
        const reason = prompt("Grund für Ablehnung:", "Leider nicht lieferbar");
        if (reason) {
            orders[index].status = 'rejected';
            orders[index].adminReply = reason;
            saveAndRenderAdmin(orders);
        }
    }
    else if (e.target.classList.contains('submit-reply')) {
        const input = e.target.previousElementSibling;
        if (input) {
            orders[index].adminReply = input.value;
            saveAndRenderAdmin(orders);
        }
    }
}

function saveAndRenderAdmin(orders) {
    localStorage.setItem('orders', JSON.stringify(orders));
    // Small delay or refresh is instant
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

        let actionButtons = '';
        if (status === 'open') {
            actionButtons = `<button class="btn btn-primary btn-sm claim-order" data-id="${order.id}">Bearbeiten (Claim)</button>`;
        } else if (status === 'captured') {
            actionButtons = `
                <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                    <input type="text" placeholder="Antwort..." style="flex:1; padding:8px; border-radius:8px; border:1px solid #333; background:#000; color:white;">
                    <button class="btn btn-secondary btn-sm submit-reply">Antwort senden</button>
                    <div style="width:100%; display:flex; gap:10px; margin-top:5px;">
                        <button class="btn btn-primary btn-sm set-ordered" style="background:#3b82f6; flex:1;">Bestellt</button>
                        <button class="btn btn-danger btn-sm set-rejected" style="flex:1;">Abgelehnt</button>
                    </div>
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
                   ${!isFinal ? actionButtons : ''}
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
    return 'status-open';
}

function getStatusLabel(status) {
    if (status === 'captured') return 'In Bearbeitung';
    if (status === 'ordered') return 'Bestellt';
    if (status === 'rejected') return 'Abgelehnt';
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

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

// --- Cart System ---
function addToCart(productId) {
    // productId comes from dataset (string) or internal logic. 
    // Ensure we compare strings to support both '1' and 'ext-123'
    const product = state.products.find(p => String(p.id) === String(productId));
    if (product) {
        state.cart.push(product);
        updateCartCount();
        alert(`${product.name} wurde zum Warenkorb hinzugefügt.`);
    } else {
        console.error('Product not found:', productId);
    }
}

function updateCartCount() {
    if (elements.cartCount) elements.cartCount.textContent = state.cart.length;
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
            total += item.price;
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <div>
                    <strong>${item.name}</strong>
                    <div>${formatPrice(item.price)}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="removeFromCart(${index})">Entfernen</button>
            `;
            container.appendChild(el);
        });
    }

    if (elements.cartTotal) elements.cartTotal.textContent = formatPrice(total);
}

window.removeFromCart = function (index) {
    state.cart.splice(index, 1);
    renderCart();
    updateCartCount();
};

function placeOrder() {
    if (state.cart.length === 0) return alert('Warenkorb ist leer.');

    const note = elements.orderNote ? elements.orderNote.value : '';

    const orders = JSON.parse(localStorage.getItem('orders') || '[]');

    // Sort logic requires parsing the ID to ensure we find the true max
    // IDs are #0001, #0002 etc.
    let maxId = 0;
    if (orders.length > 0) {
        maxId = orders.reduce((max, o) => {
            const numPart = parseInt(String(o.id).replace('#', ''), 10);
            return numPart > max ? numPart : max;
        }, 0);
    }
    const newIdNum = maxId + 1;
    // Format: #0001 (4 digits)
    const formattedId = '#' + String(newIdNum).padStart(4, '0');

    const order = {
        id: formattedId,
        user: state.currentUser.username,
        items: [...state.cart],
        total: state.cart.reduce((sum, item) => sum + item.price, 0),
        date: new Date().toLocaleString('de-DE'),
        status: 'open',
        note: note
    };

    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    state.cart = [];
    if (elements.orderNote) elements.orderNote.value = '';
    updateCartCount();

    alert('Vielen Dank für Ihre Bestellung!');
    navigateTo('catalog');
}

// --- Profile & Orders ---
function renderProfile() {
    const list = elements.profileOrdersList;
    if (!list) return;
    list.innerHTML = '';

    const orders = JSON.parse(localStorage.getItem('orders') || '[]')
        .filter(o => o.user === state.currentUser.username)
        .sort((a, b) => {
            // Extract number from #0001
            const idA = parseInt(String(a.id).replace('#', ''), 10);
            const idB = parseInt(String(b.id).replace('#', ''), 10);
            return idB - idA; // Descending (Newest first)
        });

    if (orders.length === 0) list.innerHTML = '<p>Keine Bestellungen.</p>';

    orders.forEach(order => {
        const isLocked = order.status && order.status !== 'open';

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-header">
                <span>#${order.id} <span class="status-badge ${getStatusClass(order.status)}">${getStatusLabel(order.status)}</span></span>
                <span>${order.date}</span>
                ${isLocked ? '<span style="color:#ef4444">🔒</span>' : ''}
            </div>
            <div class="order-body">
                <ul>${order.items.map(i => `<li>${i.name}</li>`).join('')}</ul>
                ${order.note ? `<p style="font-style:italic; color:var(--text-muted)">Your Note: ${order.note}</p>` : ''}
                ${order.adminReply ? `<div class="admin-reply-box"><strong>Admin:</strong> ${order.adminReply}</div>` : ''}
                
                <div style="margin-top:1rem; text-align:right;">
                    ${!isLocked ? `
                        <button class="btn btn-secondary btn-sm delete-order" data-id="${order.id}">Stornieren</button>
                    ` : '<span style="color:var(--text-muted)">In Bearbeitung - Keine Änderungen möglich</span>'}
                    <div style="margin-top:0.5rem">Gesamt: ${formatPrice(order.total)}</div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

function handleProfileAction(e) {
    if (e.target.classList.contains('delete-order')) {
        const id = e.target.dataset.id;
        if (confirm('Bestellung wirklich stornieren?')) {
            let orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders = orders.filter(o => o.id !== id);
            localStorage.setItem('orders', JSON.stringify(orders));
            renderProfile();
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
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) return;

    if (e.target.classList.contains('claim-order')) {
        orders[index].status = 'captured';
        orders[index].processedBy = state.currentUser.username;
        saveAndRenderAdmin(orders);
    }
    else if (e.target.classList.contains('confirm-order')) {
        orders[index].status = 'done';
        saveAndRenderAdmin(orders);
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
    const orders = JSON.parse(localStorage.getItem('orders') || '[]').sort((a, b) => {
        const idA = parseInt(String(a.id).replace('#', ''), 10);
        const idB = parseInt(String(b.id).replace('#', ''), 10);
        return idB - idA;
    });
    ordersList.innerHTML = '';

    if (orders.length === 0) {
        ordersList.innerHTML = '<p>Keine Bestellungen vorhanden.</p>';
        return;
    }

    orders.forEach(order => {
        const status = order.status || 'open';
        const isDone = status === 'done';

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
                    <button class="btn btn-primary btn-sm confirm-order" style="background:#22c55e">Bestätigen</button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="order-header">
                <span>#${order.id} - ${order.user}</span>
                <span class="status-badge ${getStatusClass(status)}">${getStatusLabel(status)}</span>
            </div>
            <div class="order-body">
                <ul>${order.items.map(i => `<li>${i.name}</li>`).join('')}</ul>
                ${order.note ? `<p style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px;"><strong>Kunden-Notiz:</strong> ${order.note}</p>` : ''}
                ${order.adminReply ? `<div class="admin-reply-box"><strong>Deine Antwort:</strong> ${order.adminReply}</div>` : ''}
                
                <div style="margin-top:1rem; text-align:right;">
                   <div style="margin-bottom:1rem; font-weight:bold;">${formatPrice(order.total)}</div>
                   ${!isDone ? actionButtons : ''}
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
            alert('Benutzer existiert bereits!');
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
    if (status === 'done') return 'status-done';
    return 'status-open';
}

function getStatusLabel(status) {
    if (status === 'captured') return 'In Bearbeitung';
    if (status === 'done') return 'Bestätigt';
    return 'Offen';
}

function formatPrice(price) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
}

// Start
document.addEventListener('DOMContentLoaded', init);

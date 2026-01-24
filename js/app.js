/**
 * SmartPhone Order App
 * Vanilla JS Implementation
 */

// --- State Management ---
const state = {
    currentUser: null, // { username: '', role: 'admin' | 'user' }
    cart: [],
    products: []
};

// --- DOM Elements ---
const views = {
    login: document.getElementById('login-view'),
    catalog: document.getElementById('catalog-view'),
    cart: document.getElementById('cart-view'),
    admin: document.getElementById('admin-dashboard-view')
};

const navContainer = document.getElementById('main-nav');
const menuToggle = document.getElementById('menu-toggle');

// --- Initialization ---
function init() {
    initAuth();
    setupEventListeners();
    checkSession();
}

function setupEventListeners() {
    // Menu Toggle
    menuToggle.addEventListener('click', () => {
        navContainer.classList.toggle('show');
    });

    // Login Form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = e.target.username.value;
        const pass = e.target.password.value;
        login(user, pass);
    });

    // Navigation Delegation
    navContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const targetView = e.target.dataset.view;
            if (targetView === 'logout') {
                logout();
            } else {
                navigateTo(targetView);
            }
            // Close mobile menu on navigate
            navContainer.classList.remove('show');
        }
    });

    // Catalog Buttons Delegation
    document.getElementById('product-grid').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart')) {
            const id = parseInt(e.target.dataset.id);
            addToCart(id);
        }
    });

    // Cart Button
    document.getElementById('cart-summary-btn').addEventListener('click', () => navigateTo('cart'));
    document.getElementById('back-to-catalog').addEventListener('click', () => navigateTo('catalog'));
    document.getElementById('checkout-btn').addEventListener('click', placeOrder);

    // Admin Create User
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);

    // Snuzone Search
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('snuzone-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Add external product delegation
    document.getElementById('snuzone-results-grid').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-external')) {
            const index = e.target.dataset.index;
            addExternalToCart(index);
        }
    });
}

// --- Snuzone Search System ---
let currentSearchResults = [];

async function handleSearch() {
    const query = document.getElementById('snuzone-search').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    const grid = document.getElementById('snuzone-results-grid');

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
    const PROXY_URL = 'https://api.allorigins.win/get?url=';
    const SEARCH_URL = `https://snuzone.com/search?q=${encodeURIComponent(query)}`;

    // 1. Fetch Search Results Page
    const response = await fetch(PROXY_URL + encodeURIComponent(SEARCH_URL));
    const data = await response.json();

    if (!data.contents) throw new Error('Keine Daten empfangen');

    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, 'text/html');

    // 2. Extract Product Links (first 5 unique product links)
    const links = Array.from(doc.querySelectorAll('a[href*="/products/"]'))
        .map(a => {
            const href = a.getAttribute('href');
            // Ensure absolute URL if relative
            return href.startsWith('http') ? href : `https://snuzone.com${href}`;
        })
        .filter((v, i, a) => a.indexOf(v) === i) // Unique
        .slice(0, 5); // Max 5

    if (links.length === 0) return [];

    // 3. Fetch Details for each product (Parallel)
    const productPromises = links.map(async (url) => {
        try {
            const pRes = await fetch(PROXY_URL + encodeURIComponent(url));
            const pData = await pRes.json();
            const pDoc = parser.parseFromString(pData.contents, 'text/html');

            // Extract Metadata
            const title = pDoc.querySelector('meta[property="og:title"]')?.content ||
                pDoc.querySelector('h1')?.textContent || 'Unbekanntes Produkt';

            const image = pDoc.querySelector('meta[property="og:image"]')?.content ||
                'https://placehold.co/400x300?text=No+Image';

            // Try updating price selectors based on Shopify standards
            let price = 0;
            const priceMeta = pDoc.querySelector('meta[property="og:price:amount"]');
            const priceElement = pDoc.querySelector('.price-item--regular, .product-price, .price');

            if (priceMeta) {
                price = parseFloat(priceMeta.content);
            } else if (priceElement) {
                const priceText = priceElement.textContent.replace(/[^0-9,.]/g, '').replace(',', '.');
                price = parseFloat(priceText) || 0;
            }

            return {
                id: 'ext-' + Date.now() + Math.random().toString(36).substr(2, 9),
                name: title,
                price: price,
                image: image,
                desc: 'Importiert von Snuzone',
                externalUrl: url
            };
        } catch (e) {
            console.error('Failed to fetch product', url, e);
            return null;
        }
    });

    const products = (await Promise.all(productPromises)).filter(p => p !== null);
    return products;
}

function renderSearchResults(products) {
    const grid = document.getElementById('snuzone-results-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p>Keine Produkte gefunden.</p>';
        return;
    }

    products.forEach((p, index) => {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${p.image}" alt="${p.name}" class="product-image" loading="lazy">
            <div class="product-info">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-desc">${p.desc}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(p.price)}</span>
                    <button class="btn btn-primary btn-sm add-external" data-index="${index}">
                        Hinzufügen
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function addExternalToCart(index) {
    const product = currentSearchResults[index];
    if (product) {
        // Add to local products list so it persists/works with logic
        // Check if already exists to avoid duplicates
        const exists = state.products.find(p => p.name === product.name);
        if (!exists) {
            state.products.push(product);
        }

        // Add to cart directly
        addToCart(product.id);

        // Refresh catalog to show new item
        renderCatalog();

        // Hide search results
        document.getElementById('search-results').classList.add('hidden');
        document.getElementById('snuzone-search').value = '';
    }
}

// --- Auth System ---
function initAuth() {
    // Seed initial users if empty
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
        document.getElementById('login-error').textContent = '';
        renderNav();

        if (user.role === 'admin') {
            navigateTo('admin');
        } else {
            navigateTo('catalog');
        }
    } else {
        document.getElementById('login-error').textContent = 'Ungültige Anmeldedaten.';
    }
}

function logout() {
    state.currentUser = null;
    state.cart = [];
    renderNav();
    navigateTo('login');
}

function checkSession() {
    // Simple session check - usually we'd check a token or cookie
    // For this demo, we start at login
    navigateTo('login');
}

// --- Navigation & Routing ---
function navigateTo(viewName) {
    // Hide all
    Object.values(views).forEach(el => el.classList.add('hidden'));

    // Show target
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }

    // Specific render logic per view
    if (viewName === 'catalog') renderCatalog();
    if (viewName === 'cart') renderCart();
    if (viewName === 'admin') renderAdminDashboard();
}

function renderNav() {
    navContainer.innerHTML = '';

    if (!state.currentUser) return;

    if (state.currentUser.role === 'user') {
        createNavLink('Katalog', 'catalog');
        createNavLink('Warenkorb', 'cart');
    } else if (state.currentUser.role === 'admin') {
        createNavLink('Dashboard', 'admin');
    }

    createNavLink('Abmelden', 'logout');
}

function createNavLink(text, view) {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = text;
    a.dataset.view = view;
    navContainer.appendChild(a);
}

// --- Catalog System ---
function renderCatalog() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = ''; // Clear

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
    const product = state.products.find(p => p.id === productId);
    if (product) {
        state.cart.push(product);
        updateCartCount();
        // Optional: Toast message
        alert(`${product.name} wurde zum Warenkorb hinzugefügt.`);
    }
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = state.cart.length;
}

function renderCart() {
    const container = document.getElementById('cart-items');
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

    document.getElementById('cart-total').textContent = formatPrice(total);
}

// Make globally available for onclick
window.removeFromCart = function (index) {
    state.cart.splice(index, 1);
    renderCart();
    updateCartCount();
};

function placeOrder() {
    if (state.cart.length === 0) return alert('Warenkorb ist leer.');

    const order = {
        id: Date.now(),
        user: state.currentUser.username,
        items: [...state.cart],
        total: state.cart.reduce((sum, item) => sum + item.price, 0),
        date: new Date().toLocaleString('de-DE')
    };

    // Save order
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    // Reset cart
    state.cart = [];
    updateCartCount();
    alert('Vielen Dank für Ihre Bestellung!');
    navigateTo('catalog');
}

// --- Admin System ---
function renderAdminDashboard() {
    // Only verify role again just in case
    if (state.currentUser?.role !== 'admin') return;

    const ordersList = document.getElementById('orders-list');
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    ordersList.innerHTML = '';

    if (orders.length === 0) {
        ordersList.innerHTML = '<p>Keine Bestellungen vorhanden.</p>';
        return;
    }

    // Sort by newest
    orders.sort((a, b) => b.id - a.id).forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `
            <div class="order-header">
                <span>Bestellung #${order.id}</span>
                <span>${order.date}</span>
                <span>${order.user}</span>
            </div>
            <div class="order-body">
                <ul>
                    ${order.items.map(i => `<li>${i.name} - ${formatPrice(i.price)}</li>`).join('')}
                </ul>
                <div style="margin-top: 1rem; font-weight: bold; text-align: right;">
                    Gesamt: ${formatPrice(order.total)}
                </div>
            </div>
        `;
        ordersList.appendChild(div);
    });
}

function handleCreateUser(e) {
    e.preventDefault();
    const newUsername = document.getElementById('new-username').value;
    const newPassword = document.getElementById('new-password').value;
    const msg = document.getElementById('admin-msg');

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
function formatPrice(price) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
}

// Start
document.addEventListener('DOMContentLoaded', init);

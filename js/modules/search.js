// --- js/modules/search.js ---
import { UI } from './ui.js';
import { ProductsUI } from './ui/products.js';
import { Cart } from './cart.js';

export const Search = {
    init(state, elements, addToCart) {
        this.state = state;
        this.elements = elements;
        this.addToCart = addToCart;

        const input = elements.snuzoneSearch || elements.searchInput;
        if (input) {
            // Live Search REMOVED as per user request (only Enter/Send)
            // input.addEventListener('input', (e) => this.handleSearch(e.target.value));

            // Enter Key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // Prevent form submit if any
                    e.preventDefault();
                    this.handleSearch(input.value);
                    // Hide keyboard mobile?
                    input.blur();
                }
            });

            if (input.value) this.handleSearch(input.value);
        }
    },

    // --- Widget Support for Admin ---
    renderSearchWidget(container, options = {}) {
        container.innerHTML = `
            <div class="search-widget" style="margin-bottom:20px;">
                <input type="text" id="admin-search-input" placeholder="Suche nach Snus, Vapes..." 
                    style="width:100%; padding:12px; border-radius:12px; border:1px solid #475569; background:rgba(0,0,0,0.3); color:white; font-size:1em;">
                <div id="admin-results-grid" class="product-grid" style="margin-top:20px; display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:15px;"></div>
            </div>
        `;

        const input = container.querySelector('#admin-search-input');
        const resultsGrid = container.querySelector('#admin-results-grid');

        // Bind Search
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSearch(input.value, resultsGrid, options);
                input.blur();
            }
        });
    },

    async handleSearch(query, targetGrid = null, options = {}) {
        const isWidget = !!targetGrid;
        // If Widget, use targetGrid. If Main, use global elements.
        const searchContainer = isWidget ? null : document.getElementById('search-results');
        const defaultGrid = isWidget ? null : document.getElementById('product-grid');
        const resultsGrid = targetGrid || this.elements.snuzoneResultsGrid;

        if (!query || query.length < 2) {
            // Reset
            if (resultsGrid) resultsGrid.innerHTML = '';
            if (!isWidget) {
                if (searchContainer) searchContainer.classList.add('hidden');
                if (defaultGrid) defaultGrid.classList.remove('hidden');
            }
            return;
        }

        query = query.toLowerCase();

        // Show Container logic (Main only)
        if (!isWidget) {
            if (searchContainer) searchContainer.classList.remove('hidden');
            if (defaultGrid) defaultGrid.classList.add('hidden');
        }

        // Loading
        if (resultsGrid) {
            resultsGrid.innerHTML = '<div style="text-align:center; padding:20px; color:white;">Lade Ergebnisse...</div>';
        }

        try {
            console.log(`Searching for: ${query}`);
            const searchUrl = `https://corsproxy.io/?https://snuzone.com/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`;

            const response = await fetch(searchUrl);
            if (!response.ok) throw new Error("Search failed");

            const html = await response.text();

            // --- PARSING LOGIC (Reused exactly) ---
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            let products = [];

            // Strategy 1: Analytics JSON
            const pixelMatch = html.match(/"events":"((?:\\.|[^"\\])*)"/);
            if (pixelMatch) {
                try {
                    const rawEvents = JSON.parse(`"${pixelMatch[1]}"`);
                    const events = JSON.parse(rawEvents);
                    const searchEvent = events.find(e => Array.isArray(e) && e[0] === 'search_submitted');
                    if (searchEvent && searchEvent[1].searchResult && searchEvent[1].searchResult.productVariants) {
                        const variants = searchEvent[1].searchResult.productVariants;
                        if (variants.length > 0) {
                            products = variants.map((v, idx) => {
                                let img = 'https://via.placeholder.com/150';
                                if (v.image && v.image.src) {
                                    img = v.image.src;
                                    if (img.startsWith('//')) img = 'https:' + img;
                                }
                                return {
                                    id: 'ext-' + idx + '-' + Date.now(),
                                    name: v.product.title,
                                    price: v.price.amount,
                                    originalPrice: v.price.amount,
                                    formattedPrice: v.price.amount.toFixed(2).replace('.', ',') + ' €',
                                    image: img,
                                    external: true,
                                    soldOut: false,
                                    handle: v.product.url ? v.product.url.split('?')[0].replace('/products/', '') : ''
                                };
                            });
                        }
                    }
                } catch (e) { }
            }

            // Strategy 2: DOM Fallback
            if (products.length === 0) {
                const productNodes = doc.querySelectorAll('.grid-product');
                if (productNodes.length > 0) {
                    productNodes.forEach((node, index) => {
                        const titleEl = node.querySelector('.grid-product__title');
                        const title = titleEl ? titleEl.innerText.trim() : 'Unknown';
                        let img = 'https://via.placeholder.com/150';
                        const imgEl = node.querySelector('.grid-product__image') || node.querySelector('img');
                        if (imgEl) {
                            let rawSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || imgEl.src;
                            if (rawSrc && rawSrc.includes(',')) rawSrc = rawSrc.split(',')[0].trim().split(' ')[0];
                            if (rawSrc && rawSrc.includes('{width}')) rawSrc = rawSrc.replace('{width}', '300');
                            if (rawSrc) { img = rawSrc; if (img.startsWith('//')) img = 'https:' + img; }
                        }
                        let priceStr = node.innerText;
                        const priceEl = node.querySelector('.grid-product__price') || node.querySelector('.price') || node.querySelector('.product-price');
                        if (priceEl) priceStr = priceEl.innerText;
                        const priceMatches = priceStr.match(/(\d+[,.]\d{2})/g);
                        let rawPrice = 0;
                        if (priceMatches && priceMatches.length > 0) {
                            const validPrices = priceMatches.map(p => parseFloat(p.replace(',', '.')));
                            rawPrice = Math.max(...validPrices);
                        }
                        if (title && title !== 'Unknown') {
                            products.push({
                                id: 'ext-' + index + '-' + Date.now(),
                                name: title,
                                price: rawPrice > 0 ? rawPrice : 5.00,
                                originalPrice: rawPrice > 0 ? rawPrice : 5.00,
                                formattedPrice: rawPrice.toFixed(2).replace('.', ',') + ' €',
                                image: img,
                                external: true,
                                soldOut: false
                            });
                        }
                    });
                }
            }

            this.renderSearchResults(products, resultsGrid, options);

        } catch (e) {
            console.error("Search Error", e);
            if (resultsGrid) resultsGrid.innerHTML = '<div style="text-align:center;color:#ff5555">Fehler bei der Suche</div>';
        }
    },

    renderSearchResults(products, targetGrid = null, options = {}) {
        const processedProducts = products.map(p => {
            const item = { ...p };
            const price = Cart.calculatePrice(item, this.state.currentUser);
            item.price = price.toFixed(2).replace('.', ',') + ' €';
            return item;
        });

        // Use custom elements object if targetGrid is passed, to trick ProductsUI
        const uiElements = targetGrid ? { snuzoneResultsGrid: targetGrid } : this.elements;

        ProductsUI.renderSearchResults(processedProducts, uiElements, options);

        // Event Delegation (Only if AddToCart is enabled)
        const showAddToCart = options.showAddToCart !== false;
        const grid = targetGrid || this.elements.snuzoneResultsGrid;

        if (grid && showAddToCart) {
            // Remove old listener only if Global
            if (!targetGrid && this._gridClickListener) {
                grid.removeEventListener('click', this._gridClickListener);
            }

            const handler = (e) => {
                const btn = e.target.closest('.add-external');
                if (btn) {
                    e.preventDefault(); e.stopPropagation();
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '...'; btn.disabled = true;
                    const index = btn.dataset.index;
                    const product = processedProducts[index];
                    if (product) {
                        this.addToCart(product, 1, this.state, () => {
                            const count = this.state.cart.reduce((a, b) => a + (b.quantity || 1), 0);
                            if (this.elements.cartCount) this.elements.cartCount.textContent = count;
                            btn.innerHTML = '&#10003;';
                            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 1000);
                        });
                    } else { btn.disabled = false; btn.innerHTML = originalText; }
                }
            };

            // If Widget, just add listener (assuming fresh container)
            // If Global, store ref
            if (targetGrid) {
                grid.addEventListener('click', handler);
            } else {
                this._gridClickListener = handler;
                grid.addEventListener('click', this._gridClickListener);
            }
        }
    }
};

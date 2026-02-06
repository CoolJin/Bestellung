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

    async handleSearch(query) {
        // Elements (Lazy load or passed?)
        const searchContainer = document.getElementById('search-results');
        const defaultGrid = document.getElementById('product-grid');

        if (!query || query.length < 2) {
            // Reset / Show Default
            if (this.elements.snuzoneResultsGrid) this.elements.snuzoneResultsGrid.innerHTML = '';
            if (searchContainer) searchContainer.classList.add('hidden');
            if (defaultGrid) defaultGrid.classList.remove('hidden');
            return;
        }

        query = query.toLowerCase();

        // Show Search Container, Hide Default
        if (searchContainer) searchContainer.classList.remove('hidden');
        if (defaultGrid) defaultGrid.classList.add('hidden');

        // Show loading state with Spinner and Query Text
        this.elements.snuzoneResultsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 40px; color: white;">
                    <div class="search-spinner" style="
                        width: 40px; height: 40px; margin: 0 auto 15px auto;
                        border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--primary-color);
                        border-radius: 50%; animation: spin 1s linear infinite;
                    "></div>
                    <div style="font-size:1.1em; font-weight:bold;">Suche nach "${query}"...</div>
                    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                </div>`;

        try {
            // --- High-Speed Parallel Race Strategy ---
            console.log(`Searching for: ${query} `);

            const targetUrl = `https://snuzone.com/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`;

            // Define Proxies
            const proxies = [
                {
                    name: 'AllOrigins',
                    url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
                    type: 'json'
                },
                {
                    name: 'CodeTabs',
                    url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
                    type: 'text'
                },
                {
                    name: 'CorsProxy',
                    url: `https://corsproxy.io/?${targetUrl}`,
                    type: 'text'
                }
            ];

            let html = null;

            // Timeout Wrapper
            const fetchWithTimeout = (url, timeout = 4500) => {
                return new Promise((resolve, reject) => {
                    const controller = new AbortController();
                    const id = setTimeout(() => {
                        controller.abort();
                        reject(new Error(`Timeout ${timeout}ms`));
                    }, timeout);

                    fetch(url, { signal: controller.signal })
                        .then(async response => {
                            clearTimeout(id);
                            if (!response.ok) throw new Error(`Status ${response.status}`);
                            return response;
                        })
                        .then(resolve)
                        .catch(err => {
                            clearTimeout(id);
                            reject(err);
                        });
                });
            };
            // Race Logic
            try {



                const promises = proxies.map(proxy =>
                    fetchWithTimeout(proxy.url, 4500).then(async res => {
                        let content;
                        if (proxy.type === 'json') {
                            const json = await res.json();
                            content = json.contents;
                        } else {
                            content = await res.text();
                        }
                        if (!content || content.length < 500) throw new Error("Invalid content");
                        console.log(`[Search] WINNER: ${proxy.name}`);
                        return content;
                    })
                );

                // Promise.any returns the FIRST fulfilled promise
                html = await Promise.any(promises);

            } catch (aggregateError) {
                console.error("[Search] All proxies failed", aggregateError);
                throw new Error("Verbindung fehlgeschlagen (Alle Routen blockiert oder Timeout)");
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            let products = [];

            // Scraping Strategy 1: Analytics Data (Robust JSON)
            // This is preferred because Class Names change, but Analytics data is usually stable.
            // Target: "events":"((?:\\.|[^"\\])*)" inside webPixelsManager init
            const pixelMatch = html.match(/"events":"((?:\\.|[^"\\])*)"/);
            if (pixelMatch) {
                try {
                    // Unescape stringified JSON inside stringified JSON
                    const rawEvents = JSON.parse(`"${pixelMatch[1]}"`);
                    const events = JSON.parse(rawEvents);

                    // Find 'search_submitted' event which contains the results
                    const searchEvent = events.find(e => Array.isArray(e) && e[0] === 'search_submitted');

                    if (searchEvent && searchEvent[1].searchResult && searchEvent[1].searchResult.productVariants) {
                        const variants = searchEvent[1].searchResult.productVariants;
                        if (variants.length > 0) {
                            products = variants.map((v, idx) => {
                                // Image URL cleaning
                                let img = 'https://via.placeholder.com/150';
                                if (v.image && v.image.src) {
                                    img = v.image.src;
                                    if (img.startsWith('//')) img = 'https:' + img;
                                }

                                return {
                                    id: 'ext-' + idx + '-' + Date.now(),
                                    name: v.product.title,
                                    price: v.price.amount, // Float from JSON
                                    originalPrice: v.price.amount, // Persist Original Price
                                    formattedPrice: v.price.amount.toFixed(2).replace('.', ',') + ' €',
                                    image: img,
                                    external: true,
                                    soldOut: false,
                                    // Store extra data if needed
                                    handle: v.product.url ? v.product.url.split('?')[0].replace('/products/', '') : ''
                                };
                            });
                            console.log(`[Search] Extracted ${products.length} products from Analytics JSON`);
                        }
                    }
                } catch (e) {
                    console.warn("[Search] JSON Analytics Parse Failed", e);
                }
            }

            // Scraping Strategy 2: DOM Parsing (Fallback)
            // Only run if JSON strategy found nothing
            if (products.length === 0) {
                console.log("[Search] Fallback to DOM Scraping");
                const productNodes = doc.querySelectorAll('.grid-product');

                if (productNodes.length > 0) {
                    productNodes.forEach((node, index) => {
                        // Extract Data
                        const titleEl = node.querySelector('.grid-product__title');
                        const title = titleEl ? titleEl.innerText.trim() : 'Unknown';

                        // Image: try specific class or fallback to ANY img in the card
                        let img = 'https://via.placeholder.com/150';
                        const imgEl = node.querySelector('.grid-product__image') || node.querySelector('img');
                        if (imgEl) {
                            // Priority: data-src -> srcset -> src
                            let rawSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || imgEl.src;

                            // Cleaning logic
                            if (rawSrc && rawSrc.includes(',')) {
                                rawSrc = rawSrc.split(',')[0].trim().split(' ')[0];
                            }
                            if (rawSrc && rawSrc.includes('{width}')) {
                                rawSrc = rawSrc.replace('{width}', '300');
                            }
                            if (rawSrc) {
                                img = rawSrc;
                                if (img.startsWith('//')) img = 'https:' + img;
                            }
                        }

                        // Price: Scan the ENTIRE card text for prices (Robust Fallback)
                        // This catches prices even if class names change
                        let priceStr = node.innerText;

                        // Specific price element check (Priority)
                        const priceEl = node.querySelector('.grid-product__price') || node.querySelector('.price') || node.querySelector('.product-price');
                        if (priceEl) priceStr = priceEl.innerText;

                        // UPDATED: Logic to find Original Price (Maximum Value found)
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
                                mean: rawPrice > 0 ? rawPrice : 5.00, // Store RAW number. Fallback 5.00 if parsing fails.
                                originalPrice: rawPrice > 0 ? rawPrice : 5.00, // Persist Original Price
                                formattedPrice: rawPrice.toFixed(2).replace('.', ',') + ' €', // For UI display if needed directly
                                image: img,
                                external: true,
                                soldOut: false
                            });
                        }
                    });
                } else {
                    console.warn("Snuzone: No products found with selectors (.grid-product)");
                }
            }

            this.renderSearchResults(products);

        } catch (e) {
            console.error("Search Error", e);
            if (this.elements.snuzoneResultsGrid) {
                this.elements.snuzoneResultsGrid.innerHTML = '<div style="text-align:center;color:#ff5555">Fehler bei der Suche</div>';
            }
        }
    },

    renderSearchResults(products) {
        const processedProducts = products.map(p => {
            // Clone
            const item = { ...p };
            // Calculate Dynamic Price
            const price = Cart.calculatePrice(item, this.state.currentUser);
            item.price = price.toFixed(2).replace('.', ',') + ' €';
            return item;
        });

        ProductsUI.renderSearchResults(processedProducts, this.elements);

        // Handlers: Event Delegation (Fix for Lost Listeners)
        const grid = this.elements.snuzoneResultsGrid;
        if (grid) {
            // Remove old listener to avoid duplicates if re-init (though handleSearch is instance method)
            if (this._gridClickListener) {
                grid.removeEventListener('click', this._gridClickListener);
            }

            this._gridClickListener = (e) => {
                const btn = e.target.closest('.add-external');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Visual Feedback
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '...';
                    btn.disabled = true;

                    const index = btn.dataset.index;
                    const product = processedProducts[index];

                    if (product) {
                        this.addToCart(product, 1, this.state, () => {
                            // Update Cart Count UI
                            const count = this.state.cart.reduce((a, b) => a + (b.quantity || 1), 0);
                            if (this.elements.cartCount) this.elements.cartCount.textContent = count;

                            // Restore Button
                            btn.innerHTML = '&#10003;'; // Checkmark
                            setTimeout(() => {
                                btn.innerHTML = originalText;
                                btn.disabled = false;
                            }, 1000);
                        });
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                }
            };

            grid.addEventListener('click', this._gridClickListener);
        }
    }
};

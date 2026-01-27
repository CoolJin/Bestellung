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

        // Show loading state
        if (this.elements.snuzoneResultsGrid) {
            this.elements.snuzoneResultsGrid.innerHTML = '<div style="text-align:center; padding:20px; color:white;">Lade Ergebnisse...</div>';
        }

        try {
            // Use External Search Proxy (Snuzone)
            console.log(`Searching for: ${query}`);
            // Added timestamp to force fresh fetch (cache busting)
            const searchUrl = `https://corsproxy.io/?https://snuzone.com/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`;

            const response = await fetch(searchUrl);
            if (!response.ok) throw new Error("Search failed");

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            let products = [];

            // Scraping Strategy 1: Analytics Data (Robust JSON) - DISABLED TO FORCE DOM SCRAPING (Better Metadata)
            /*
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
            */

            // Scraping Strategy 2: DOM Parsing (Primary)
            // products array is empty because Strategy 1 is disabled/skipped
            if (products.length === 0) {
                console.log("[Search] Using DOM Scraping for Rich Metadata");
                const productNodes = doc.querySelectorAll('.grid-product');

                if (productNodes.length > 0) {
                    productNodes.forEach((node, index) => {
                        // Extract Data
                        const titleEl = node.querySelector('.grid-product__title');
                        const title = titleEl ? titleEl.innerText.trim() : 'Unknown';

                        // Strength Info Extraction
                        let strength_g = '';
                        let strength_p = '';
                        const propsUl = node.querySelector('.grid-product__properties');
                        if (propsUl) {
                            const lis = propsUl.querySelectorAll('li');
                            if (lis.length > 0) strength_g = lis[0].innerText.trim();
                            if (lis.length > 1) strength_p = lis[1].innerText.trim();
                        }

                        // Image: Find ANY image that looks like a product image
                        let img = 'https://via.placeholder.com/150';
                        const allImgs = node.querySelectorAll('img');
                        let bestImgSrc = null;

                        for (const iEl of allImgs) {
                            // Check candidate sources
                            const candidateSrc = iEl.getAttribute('data-src') ||
                                iEl.getAttribute('data-srcset') ||
                                iEl.getAttribute('srcset') ||
                                iEl.src;

                            if (candidateSrc && (candidateSrc.includes('shopify') || candidateSrc.includes('snuzone'))) {
                                bestImgSrc = candidateSrc;
                                break; // Found a likely product image
                            }
                        }

                        // Fallback to first image if no "shopify" image found
                        if (!bestImgSrc && allImgs.length > 0) {
                            const iEl = allImgs[0];
                            bestImgSrc = iEl.getAttribute('data-src') || iEl.getAttribute('srcset') || iEl.src;
                        }

                        if (bestImgSrc) {
                            let rawSrc = bestImgSrc;
                            // Cleaning logic
                            if (rawSrc.includes(',')) {
                                rawSrc = rawSrc.split(',')[0].trim().split(' ')[0];
                            }
                            if (rawSrc.includes('{width}')) {
                                rawSrc = rawSrc.replace('{width}', '300');
                            }

                            if (rawSrc.startsWith('//')) {
                                img = 'https:' + rawSrc;
                            } else if (rawSrc.startsWith('http')) {
                                img = rawSrc;
                            } else {
                                img = rawSrc;
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
                                price: rawPrice > 0 ? rawPrice : 5.00, // Store RAW number. Fallback 5.00 if parsing fails.
                                originalPrice: rawPrice > 0 ? rawPrice : 5.00, // Persist Original Price
                                formattedPrice: rawPrice.toFixed(2).replace('.', ',') + ' €', // For UI display if needed directly
                                image: img,
                                external: true,
                                soldOut: false,
                                strength_g: strength_g, // New field for mg/g
                                strength_p: strength_p  // New field for mg/pouch
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

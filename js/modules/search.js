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
        const searchContainer = document.getElementById('search-results');
        const defaultGrid = document.getElementById('product-grid');

        if (!query || query.length < 2) {
            if (this.elements.snuzoneResultsGrid) this.elements.snuzoneResultsGrid.innerHTML = '';
            if (searchContainer) searchContainer.classList.add('hidden');
            if (defaultGrid) defaultGrid.classList.remove('hidden');
            return;
        }

        query = query.toLowerCase();

        if (searchContainer) searchContainer.classList.remove('hidden');
        if (defaultGrid) defaultGrid.classList.add('hidden');

        if (this.elements.snuzoneResultsGrid) {
            this.elements.snuzoneResultsGrid.innerHTML = '<div style="text-align:center; padding:20px; color:white;">Lade Ergebnisse...</div>';
        }

        try {
            console.log(`Searching for: ${query}`);
            const searchUrl = `https://corsproxy.io/?https://snuzone.com/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`;

            const response = await fetch(searchUrl);
            if (!response.ok) throw new Error("Search failed");

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            let products = [];

            // Strategy 1: DOM Scraping (Prioritized for Meta Data like Nicotine)
            const productNodes = doc.querySelectorAll('.grid-product');
            const resultItems = doc.querySelectorAll('.snuzone-result-item'); // Hypothetical class

            // Nicotine Regex
            // Matches "16 mg/g" or "16mg/g"
            const nicRegexG = /(\d+(?:[.,]\d+)?)\s*mg\/g/i;
            // Matches "10,4 mg/Beutel" or "mg/Pouch"
            const nicRegexP = /(\d+(?:[.,]\d+)?)\s*mg\/(?:Beutel|Pouch)/i;

            const nodesToScan = productNodes.length > 0 ? productNodes : resultItems;

            if (nodesToScan.length > 0) {
                nodesToScan.forEach((node, index) => {
                    const fullText = node.innerText;

                    // Extract Nicotine Info
                    const mgPerG = fullText.match(nicRegexG);
                    const mgPerPouch = fullText.match(nicRegexP);

                    let nicInfo = [];
                    if (mgPerG) nicInfo.push(`${mgPerG[1]} mg/g`);
                    if (mgPerPouch) nicInfo.push(`${mgPerPouch[1]} mg/Btl.`);

                    // Title
                    const titleEl = node.querySelector('.grid-product__title') || node.querySelector('.title');
                    const title = titleEl ? titleEl.innerText.trim() : 'Unbekannt';

                    // Price
                    const priceEl = node.querySelector('.grid-product__price') || node.querySelector('.price');
                    let priceVal = 0;
                    let priceStr = '0,00 €';

                    if (priceEl) {
                        const rawPrice = priceEl.innerText.replace(/[^\d.,]/g, '').replace(',', '.');
                        priceVal = parseFloat(rawPrice);
                    } else {
                        // Fallback
                        const pMatch = fullText.match(/(\d+[.,]\d+)\s*€/);
                        if (pMatch) {
                            priceVal = parseFloat(pMatch[1].replace(',', '.'));
                        }
                    }
                    if (priceVal) priceStr = priceVal.toFixed(2).replace('.', ',') + ' €';

                    // Image
                    let img = 'https://via.placeholder.com/150';
                    const imgEl = node.querySelector('img');
                    if (imgEl) {
                        let rawSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || imgEl.src;
                        if (rawSrc) {
                            if (rawSrc.includes(',')) rawSrc = rawSrc.split(',')[0].trim().split(' ')[0];
                            if (rawSrc.includes('{width}')) rawSrc = rawSrc.replace('{width}', '300');
                            if (rawSrc.startsWith('//')) rawSrc = 'https:' + rawSrc;
                            img = rawSrc;
                        }
                    }

                    // Handle / Link
                    let handle = '';
                    const linkEl = node.querySelector('a');
                    if (linkEl && linkEl.href) {
                        const parts = linkEl.href.split('/products/');
                        if (parts.length > 1) {
                            handle = parts[1].split('?')[0];
                        }
                    }

                    if (title !== 'Unbekannt') {
                        products.push({
                            id: 'dom-' + index + '-' + Date.now(),
                            name: title,
                            price: priceVal,
                            formattedPrice: priceStr,
                            image: img,
                            handle: handle,
                            nicotine: nicInfo.length > 0 ? nicInfo : null,
                            external: true
                        });
                    }
                });
                console.log(`[Search] Scraped ${products.length} products via DOM.`);
            }

            // Fallback: Analytics JSON (Only if DOM returns nothing)
            if (products.length === 0) {
                console.log('[Search] DOM returned 0 items. Checking Analytics...');
                const pixelMatch = html.match(/"events":"((?:\\.|[^"\\])*)"/);
                if (pixelMatch) {
                    try {
                        const rawEvents = JSON.parse(`"${pixelMatch[1]}"`);
                        const events = JSON.parse(rawEvents);
                        const searchEvent = events.find(e => Array.isArray(e) && e[0] === 'search_submitted');
                        if (searchEvent && searchEvent[1].searchResult && searchEvent[1].searchResult.productVariants) {
                            products = searchEvent[1].searchResult.productVariants.map((v, i) => ({
                                id: 'ext-' + i,
                                name: v.product.title,
                                price: v.price.amount,
                                formattedPrice: v.price.amount.toFixed(2).replace('.', ',') + ' €',
                                image: v.image ? (v.image.src.startsWith('//') ? 'https:' + v.image.src : v.image.src) : 'https://via.placeholder.com/150',
                                handle: v.product.url ? v.product.url.split('?')[0].replace('/products/', '') : '',
                                external: true,
                                nicotine: null // No Nicotine in JSON
                            }));
                        }
                    } catch (e) { console.warn('JSON Parse Error', e); }
                }
            }

            this.displayResults(products);

        } catch (error) {
            console.error('Search error:', error);
            if (this.elements.snuzoneResultsGrid) {
                this.elements.snuzoneResultsGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Fehler bei der Suche.</div>';
            }
        }
    },

    displayResults(products) {
        if (!this.elements.snuzoneResultsGrid) return;

        if (products.length === 0) {
            this.elements.snuzoneResultsGrid.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">Keine Ergebnisse gefunden.</div>';
            return;
        }

        this.elements.snuzoneResultsGrid.innerHTML = products.map(p => {
            // Nicotine HTML
            let nicHtml = '';
            if (p.nicotine && p.nicotine.length > 0) {
                // Style: Small Row under Title
                nicHtml = `
                    <div style="display:flex; justify-content:center; gap:6px; margin:5px 0; flex-wrap:wrap;">
                        ${p.nicotine.map(n => `
                            <span style="font-size:0.75em; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; color:#ccc;">
                                ${n}
                            </span>
                        `).join('')}
                    </div>
                `;
            }

            return `
            <div class="card product-card" onclick="window.addToCartWrapper('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}', '${p.handle}')">
                <div class="card-img-container">
                    <img src="${p.image}" alt="${p.name}">
                </div>
                <div class="card-content">
                    <h3 class="card-title">${p.name}</h3>
                    ${nicHtml}
                    <div class="card-price">${p.formattedPrice}</div>
                    <button class="btn btn-primary add-to-cart-btn" style="width:100%; margin-top:10px;">
                        Hinzufügen
                    </button>
                </div>
            </div>
            `;
        }).join('');

        // Expose wrapper for onclick
        window.addToCartWrapper = (id, title, price, image, handle) => {
            // Create a standardized product object
            const product = {
                id: String(id),
                title: title, // Map to title for Cart
                price: price,
                images: [{ src: image }],
                handle: handle
            };
            // Call the main addToCart
            this.addToCart(product);
        };
    }
};

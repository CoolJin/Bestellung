// --- js/modules/search.js ---
export const Search = {
    controller: null,
    results: [],

    async handleSearch(query, elements, renderSearchResults, clearSearch) {
        if (!query) return clearSearch();

        const resultsContainer = document.getElementById('search-results');
        const feedback = elements.searchFeedback;
        const grid = elements.snuzoneResultsGrid;

        if (this.controller) this.controller.abort();
        this.controller = new AbortController();

        resultsContainer.classList.remove('hidden');
        feedback.classList.remove('hidden');
        feedback.innerHTML = '<span class="loader"></span> Suche läuft...';
        grid.innerHTML = '';

        try {
            const products = await this.searchSnuzone(query, this.controller.signal);
            if (this.controller.signal.aborted) return;

            this.results = products;
            feedback.innerHTML = '';
            feedback.classList.add('hidden');
            renderSearchResults(products);
        } catch (error) {
            if (error.name === 'AbortError') return;
            feedback.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    },

    clearSearch(elements) {
        elements.snuzoneSearch.value = '';
        document.getElementById('search-results').classList.add('hidden');
        elements.searchFeedback.classList.add('hidden');
    },

    async searchSnuzone(query, signal) {
        const proxies = [
            { url: (q) => `https://corsproxy.io/?https://snuzone.com/search?q=${encodeURIComponent(q)}`, extractor: async (r) => await r.text() },
            { url: (q) => `https://api.allorigins.win/get?url=${encodeURIComponent('https://snuzone.com/search?q=' + q)}`, extractor: async (r) => (await r.json()).contents }
        ];

        let html = null;
        for (const proxy of proxies) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);
                const onAbort = () => controller.abort();
                signal.addEventListener('abort', onAbort);

                const res = await fetch(proxy.url(query), { signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) throw new Error('Status ' + res.status);

                html = await proxy.extractor(res);
                signal.removeEventListener('abort', onAbort);

                if (html && html.length > 500) break;
            } catch (e) {
                console.warn('Proxy failed', e);
            }
        }

        if (!html) throw new Error('Keine Verbindung zu Snuzone.');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Parse Search Results Grid directly (No detail fetches needed)
        const productsItems = Array.from(doc.querySelectorAll('.grid-product'));

        const details = productsItems.map(el => {
            try {
                let p = {};

                // Strategy 1: Wishlist JSON Data (Most Reliable)
                const wishlistBtn = el.querySelector('button[data-component="WishlistButton"]');
                if (wishlistBtn && wishlistBtn.dataset.props) {
                    try {
                        const props = JSON.parse(wishlistBtn.dataset.props);
                        p.name = props.dt;
                        p.price = props.pr ? props.pr.toFixed(2).replace('.', ',') + ' €' : 'Ausverkauft';
                        // Fix Image URL (remove params like ?v=...)
                        let img = props.iu;
                        if (img) {
                            if (img.startsWith('//')) img = 'https:' + img;
                            p.image = img.split('?')[0];
                        }
                        p.soldOut = false;
                        if (props.stk !== undefined && props.stk === 0) p.soldOut = true;
                    } catch (e) { }
                }

                // Strategy 2: DOM fallback
                if (!p.name) {
                    p.name = el.querySelector('.grid-product__title')?.textContent?.trim() || 'Produkt';
                }
                if (!p.price) {
                    const priceEl = el.querySelector('.product-price');
                    if (priceEl) p.price = priceEl.textContent.trim().replace(/\n/g, '').replace(/ +/g, ' ');
                    if (!p.price || p.price === '') p.price = 'Preis auf Anfrage';
                }
                if (!p.image) {
                    const imgDiv = el.querySelector('.grid__image-ratio');
                    if (imgDiv && imgDiv.dataset.bgset) {
                        // bgset format: "//url 180w, //url 360w"
                        const firstUrl = imgDiv.dataset.bgset.split(',')[0].trim().split(' ')[0];
                        if (firstUrl) p.image = 'https:' + firstUrl;
                    }
                }

                // Final Sold Out Check
                if (p.soldOut === undefined) {
                    const badge = el.querySelector('.grid-product__tag--sold-out') || el.querySelector('.sold-out-badge');
                    if (badge) p.soldOut = true;
                    if (p.price && p.price.toLowerCase().includes('ausverkauft')) p.soldOut = true;
                }

                return {
                    id: 'ext-' + Math.random().toString(36),
                    name: p.name,
                    price: p.price,
                    image: p.image || 'https://placehold.co/300x300?text=No+Image',
                    soldOut: !!p.soldOut,
                    desc: 'Snuzone Import'
                };
            } catch (e) { return null; }
        }).filter(item => item && item.name !== 'Produkt').slice(0, 12);

        return details;
    }
};

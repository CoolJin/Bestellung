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

        const links = Array.from(doc.querySelectorAll('a[href*="/products/"]'))
            .map(a => a.getAttribute('href').startsWith('http') ? a.getAttribute('href') : 'https://snuzone.com' + a.getAttribute('href'))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 12);

        const details = await Promise.all(links.map(async (url) => {
            if (signal.aborted) return null;
            try {
                const res = await fetch(`https://corsproxy.io/?${url}`, { signal: signal });
                const text = await res.text();
                const pDoc = parser.parseFromString(text, 'text/html');

                const title = pDoc.querySelector('h1')?.textContent?.trim() || 'Produkt';
                let image = pDoc.querySelector('.product__media img')?.src || '';
                if (image.startsWith('//')) image = 'https:' + image;

                let isSoldOut = false;
                const btn = pDoc.querySelector('button[name="add"]');
                if (btn && (btn.disabled || btn.textContent.toLowerCase().includes('sold') || btn.textContent.toLowerCase().includes('ausverkauft'))) isSoldOut = true;
                if (text.includes('ausverkauft') && text.includes('product-custom-badge')) isSoldOut = true;

                return {
                    id: 'ext-' + Math.random().toString(36),
                    name: title,
                    price: 0,
                    image,
                    soldOut: isSoldOut,
                    desc: 'Snuzone Import'
                };
            } catch (e) { return null; }
        }));

        return details.filter(d => d);
    }
};

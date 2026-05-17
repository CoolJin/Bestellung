export const handleSearchLogic = async (query) => {
    if (!query || query.length < 2) {
        return [];
    }
    
    query = query.toLowerCase();
    console.log(`Searching for: ${query} `);
    
    const targetUrl = `https://snuzone.com/search?q=${encodeURIComponent(query)}&_t=${Date.now()}`;
    
    // Define Proxies EXACTLY as they were
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
    if (products.length === 0) {
        console.log("[Search] Fallback to DOM Scraping");
        const productNodes = doc.querySelectorAll('.grid-product');
        
        if (productNodes.length > 0) {
            productNodes.forEach((node, index) => {
                const titleEl = node.querySelector('.grid-product__title');
                const title = titleEl ? titleEl.innerText.trim() : 'Unknown';
                
                let img = 'https://via.placeholder.com/150';
                const imgEl = node.querySelector('.grid-product__image') || node.querySelector('img');
                if (imgEl) {
                    let rawSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || imgEl.src;
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
                        mean: rawPrice > 0 ? rawPrice : 5.00,
                        originalPrice: rawPrice > 0 ? rawPrice : 5.00,
                        formattedPrice: rawPrice.toFixed(2).replace('.', ',') + ' €',
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
    
    return products;
};

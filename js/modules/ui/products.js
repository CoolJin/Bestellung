// --- js/modules/ui/products.js ---
export const ProductsUI = {
    renderCatalog(elements, state) {
        const grid = elements.productGrid;
        if (!grid) return;
        grid.innerHTML = '';

        if (state.products.length > 0) {
            state.products.forEach(p => {
                const card = document.createElement('article');
                card.className = 'product-card';
                card.innerHTML = `
                     <img src="${p.image}" class="product-image" alt="${p.name}">
                     <div class="product-info">
                         <h3>${p.name}</h3>
                         <div class="product-footer">
                             <div class="product-price">${p.price || 'Kein Preis'}</div>
                             <button class="btn btn-primary btn-sm add-to-cart" data-id="${p.id}">Hinzufügen</button>
                         </div>
                     </div>
                 `;
                grid.appendChild(card);
            });
        }
    },

    renderSearchResults(products, elements) {
        const grid = elements.snuzoneResultsGrid;
        if (!grid) return;
        grid.innerHTML = '';

        if (products.length === 0) {
            grid.innerHTML = '<p>Keine Produkte gefunden.</p>';
            return;
        }

        products.forEach((p, index) => {
            const card = document.createElement('article');
            card.className = `product-card ${p.soldOut ? 'sold-out' : ''}`;
            card.innerHTML = `
                ${p.soldOut ? '<div class="sold-out-badge">Ausverkauft</div>' : ''}
                <img src="${p.image}" class="product-image" alt="${p.name}">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="product-footer">
                         <div class="product-price">${p.price}</div>
                        ${!p.soldOut ? `<button class="btn btn-primary btn-sm add-external" data-index="${index}">Hinzufügen</button>` : '<button disabled class="btn btn-secondary btn-sm">N/A</button>'}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }
};

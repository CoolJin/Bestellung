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
            // Live Search
            input.addEventListener('input', (e) => this.handleSearch(e.target.value));

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

    handleSearch(query) {
        if (!query) query = '';
        query = query.toLowerCase();

        // If empty, user might want all products? Or reset?
        // User said "Show all initially".
        let results = [];
        if (query.length < 1) {
            results = this.state.products.slice(0, 12);
        } else {
            results = this.state.products.filter(p => p.name.toLowerCase().includes(query));
        }

        this.renderSearchResults(results);
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

        // Handlers
        const grid = this.elements.snuzoneResultsGrid;
        if (grid) {
            grid.querySelectorAll('.add-external').forEach(btn => {
                btn.onclick = () => {
                    const index = btn.dataset.index;
                    const product = processedProducts[index];
                    if (product) {
                        this.addToCart(product, 1, this.state, () => {
                            const count = this.state.cart.reduce((a, b) => a + (b.quantity || 1), 0);
                            if (this.elements.cartCount) this.elements.cartCount.textContent = count;
                        });
                    }
                };
            });
        }
    }
};

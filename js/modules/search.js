// --- js/modules/search.js ---
import { UI } from './ui.js';
import { ProductsUI } from './ui/products.js'; // Might move render logic here
import { Cart } from './cart.js'; // Import Cart for Pricing calculation

export const Search = {
    init(state, elements, addToCart) {
        this.state = state;
        this.elements = elements;
        this.addToCart = addToCart;

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
    },

    handleSearch(query) {
        query = query.toLowerCase();
        if (query.length < 1) {
            // Show Catalog (Initial 12) if empty
            // We reuse renderSearchResults logic or custom?
            // User requested "Show all" initially.
            this.renderSearchResults(this.state.products.slice(0, 12));
            return;
        }

        const results = this.state.products.filter(p => {
            return p.name.toLowerCase().includes(query);
            // Ignore description for now if unnecessary
        });

        this.renderSearchResults(results);
    },

    renderSearchResults(products) {
        // Calculate Effective Prices for Products before rendering
        // Use currentUser from state
        const processedProducts = products.map(p => {
            // Clone
            const item = { ...p };
            const price = Cart.calculatePrice(item, this.state.currentUser);
            item.price = price.toFixed(2).replace('.', ',') + ' €';
            return item;
        });

        ProductsUI.renderSearchResults(processedProducts, this.elements);

        // Setup Handlers (Add Button)
        const grid = this.elements.snuzoneResultsGrid;
        if (grid) {
            grid.querySelectorAll('.add-external').forEach(btn => {
                btn.onclick = () => {
                    const index = btn.dataset.index;
                    // Note: index matches passed array. 
                    // ProductsUI renders using index of passed array.
                    const product = processedProducts[index];
                    if (product) {
                        this.addToCart(product, 1, this.state, () => {
                            // Update cart count UI helper
                            const count = this.state.cart.reduce((a, b) => a + (b.quantity || 1), 0);
                            if (this.elements.cartCount) this.elements.cartCount.textContent = count;
                        });
                    }
                };
            });
        }
    }
};

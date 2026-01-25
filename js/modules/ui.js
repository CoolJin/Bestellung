// --- js/modules/ui.js ---
import { CoreUI } from './ui/core.js';
import { OrdersUI } from './ui/orders.js';
import { ProductsUI } from './ui/products.js';
import { CartUI } from './ui/cart.js';
import { ProfileUI } from './ui/profile.js';
import { AdminUI } from './ui/admin.js';

export const UI = {
    ...CoreUI,
    ...OrdersUI,
    ...ProductsUI,
    ...CartUI,
    ...ProfileUI,
    ...AdminUI
};

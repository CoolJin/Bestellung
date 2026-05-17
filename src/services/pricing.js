/**
 * SNS Bestellsystem — Zentrales Preissystem
 *
 * Regeln:
 *  - Alle Nutzer:            Preis < 5 → 5 €  |  Preis >= 5 → ceil(Preis)
 *  - Pablo-Flatrate-Nutzer
 *    + Marke "Pablo":        Preis < 4 → 4 €  |  Preis >= 4 → ceil(Preis)
 *
 * Kurz: Math.max(minimum, Math.ceil(rawPrice))
 */

/**
 * Erkennt ob ein Produkt zur Marke "Pablo" gehört.
 * Prüft den Produkt-Namen (case-insensitive).
 */
export const isPabloBrand = (product) => {
    const name = (product?.name || '').toLowerCase();
    return name.includes('pablo');
};

/**
 * Berechnet den Verkaufspreis für ein Produkt abhängig vom Nutzer.
 * @param {Object} product  - Produkt-Objekt mit originalPrice oder price
 * @param {Object|null} user - Aktueller Nutzer (aus AppContext.currentUser)
 * @returns {number} Berechneter Preis in Euro (ganzzahlig oder >= 5/4)
 */
export const calculatePrice = (product, user) => {
    const raw = Number(product?.originalPrice ?? product?.price ?? 0);

    // Pablo Flatrate + Marke Pablo → Minimum 4 €, sonst ceil
    if (user?.isPablo && isPabloBrand(product)) {
        return Math.max(4, Math.ceil(raw));
    }

    // Alle anderen → Minimum 5 €, sonst ceil
    return Math.max(5, Math.ceil(raw));
};

/**
 * Formatiert einen Preis für die Anzeige: "5,00 €"
 */
export const formatPrice = (price) => {
    return Number(price).toFixed(2).replace('.', ',') + ' €';
};

/**
 * Berechnet den Warenkorb-Gesamtpreis.
 * Nutzt calculatePrice für jedes Item.
 */
export const calculateCartTotal = (cart, user) => {
    return cart.reduce((acc, item) => {
        return acc + calculatePrice(item, user) * (item.quantity || 1);
    }, 0);
};

/**
 * Berechnet den Admin-Extras VK-Preis (Verkaufspreis an Kunden).
 * Extras werden immer zum "Standard"-Preis berechnet (kein User-Kontext).
 * VK = Math.max(5, Math.ceil(ek))
 */
export const calculateVK = (product) => {
    const raw = Number(product?.originalPrice ?? product?.price ?? 0);
    return Math.max(5, Math.ceil(raw));
};

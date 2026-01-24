/**
 * Database Module (db.js)
 * Handles localStorage persistence for Users and Orders.
 * Acts as the "Backend" for this prototype.
 */

const DB = {
    // Keys
    KEYS: {
        USERS: 'users',
        ORDERS: 'orders',
        SESSION: 'session'
    },

    // --- Users ---
    getUsers() {
        return JSON.parse(localStorage.getItem(this.KEYS.USERS) || '[]');
    },

    createUser(username, password) {
        const users = this.getUsers();
        if (users.find(u => u.username === username)) {
            throw new Error('Benutzer existiert bereits');
        }
        users.push({ username, password, role: 'user' });
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    },

    authenticate(username, password) {
        // Hardcoded Admins/Defaults (Fallback)
        if (username === 'admin' && password === 'admin123') return { username, role: 'admin' };
        if (username === 'user' && password === 'user123') return { username, role: 'user' };

        const users = this.getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) return { username: user.username, role: user.role };
        return null;
    },

    // --- Session ---
    saveSession(user) {
        localStorage.setItem(this.KEYS.SESSION, JSON.stringify({
            user,
            lastActive: Date.now()
        }));
    },

    getSession() {
        try {
            const data = localStorage.getItem(this.KEYS.SESSION);
            if (!data) return null;
            const session = JSON.parse(data);
            const now = Date.now();
            // 15 Minutes Timeout
            if (now - session.lastActive > 900000) {
                this.clearSession();
                return null;
            }
            // Update last active
            session.lastActive = now;
            localStorage.setItem(this.KEYS.SESSION, JSON.stringify(session));
            return session.user;
        } catch (e) {
            return null;
        }
    },

    updateSessionActivity() {
        const data = localStorage.getItem(this.KEYS.SESSION);
        if (data) {
            const session = JSON.parse(data);
            session.lastActive = Date.now();
            localStorage.setItem(this.KEYS.SESSION, JSON.stringify(session));
        }
    },

    clearSession() {
        localStorage.removeItem(this.KEYS.SESSION);
    },

    // --- Orders ---
    getOrders() {
        return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
    },

    saveOrder(order) {
        const orders = this.getOrders();
        orders.push(order);
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    },

    updateOrder(id, mutator) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(o => String(o.id) === String(id));
        if (orderIndex !== -1) {
            mutator(orders[orderIndex]);
            localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
            return true;
        }
        return false;
    },

    deleteOrder(id) {
        let orders = this.getOrders();
        orders = orders.filter(o => String(o.id) !== String(id));
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
    },

    // --- ID Generation ---
    generateOrderId(editingId = null) {
        if (editingId) {
            // Reuse logic: #1234 -> #1234B
            const base = String(editingId).replace('B', ''); // Safety strip if double edit
            if (!String(editingId).endsWith('B')) return base + 'B';
            return String(editingId); // Keep #1234B
        }

        const orders = this.getOrders();
        let maxId = 0;
        orders.forEach(o => {
            const numPart = parseInt(String(o.id).replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) {
                maxId = numPart;
            }
        });
        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

// Export to window for app.js
window.DB = DB;

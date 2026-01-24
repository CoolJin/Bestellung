/**
 * Database Module (db.js)
 * Handles data persistence using localStorage, initialized from data.json.
 * Simulates a file-based database.
 */

const DB = {
    // Keys
    KEYS: {
        DATA: 'app_data_v1', // Unified store or keep separate? Let's keep keys separate for cleaner LS, but init from JSON.
        USERS: 'users',
        ORDERS: 'orders',
        SESSION: 'session'
    },

    state: {
        users: [],
        orders: []
    },

    async init() {
        // Try to load from LocalStorage first
        const localUsers = localStorage.getItem(this.KEYS.USERS);
        const localOrders = localStorage.getItem(this.KEYS.ORDERS);

        if (localUsers && localOrders) {
            this.state.users = JSON.parse(localUsers);
            this.state.orders = JSON.parse(localOrders);
            console.log('DB: Loaded from LocalStorage');
        } else {
            // First time load or clear: Fetch from data.json
            try {
                const res = await fetch('data/data.json');
                if (res.ok) {
                    const data = await res.json();
                    this.state.users = data.users || [];
                    this.state.orders = data.orders || [];

                    // Fallback: If no users loaded, restore defaults
                    if (this.state.users.length === 0) {
                        this.state.users = [
                            { username: 'admin', password: '123', role: 'admin' },
                            { username: 'user', password: '123', role: 'user' }
                        ];
                    }

                    this.saveData(); // Persist to LS immediately
                    console.log('DB: Initialized from data.json');
                } else {
                    throw new Error('Fetch failed');
                }
            } catch (e) {
                console.error('DB: Failed to load data.json, using defaults.', e);
                this.state.users = [
                    { username: 'admin', password: '123', role: 'admin' },
                    { username: 'user', password: '123', role: 'user' }
                ];
                this.saveData();
            }
        }
    },

    saveData() {
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(this.state.users));
        localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(this.state.orders));
    },

    // --- Users ---
    getUsers() {
        return this.state.users;
    },

    createUser(username, password) {
        if (this.state.users.find(u => u.username === username)) {
            throw new Error('Benutzer existiert bereits');
        }
        this.state.users.push({ username, password, role: 'user' });
        this.saveData();
    },

    deleteUser(username) {
        this.state.users = this.state.users.filter(u => u.username !== username);
        this.saveData();
    },

    authenticate(username, password) {
        const user = this.state.users.find(u => u.username === username && u.password === password);
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
        return this.state.orders;
    },

    saveOrder(order) {
        this.state.orders.push(order);
        this.saveData();
    },

    updateOrder(id, mutator) {
        const order = this.state.orders.find(o => String(o.id) === String(id));
        if (order) {
            mutator(order);
            this.saveData();
            return true;
        }
        return false;
    },

    deleteOrder(id) {
        this.state.orders = this.state.orders.filter(o => String(o.id) !== String(id));
        this.saveData();
    },

    // --- ID Generation ---
    generateOrderId(editingId = null) {
        if (editingId) {
            const base = String(editingId).replace('B', '');
            if (!String(editingId).endsWith('B')) return base + 'B';
            return String(editingId);
        }

        let maxId = 0;
        this.state.orders.forEach(o => {
            const numPart = parseInt(String(o.id).replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) {
                maxId = numPart;
            }
        });
        // Start explicit numbering if empty, e.g. 1000
        if (maxId === 0) maxId = 1000;

        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

// Export to window for app.js
window.DB = DB;

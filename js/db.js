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

        let usersLoaded = false;
        let ordersLoaded = false;

        if (localUsers) {
            try {
                this.state.users = JSON.parse(localUsers);
                usersLoaded = true;
                console.log('DB: Users loaded from LocalStorage');
            } catch (e) {
                console.error('DB: Error parsing users from LS', e);
            }
        }

        if (localOrders) {
            try {
                this.state.orders = JSON.parse(localOrders);
                ordersLoaded = true;
                console.log('DB: Orders loaded from LocalStorage');
            } catch (e) {
                console.error('DB: Error parsing orders from LS', e);
            }
        }

        // If either is missing, try to fetch default data for missing parts
        if (!usersLoaded || !ordersLoaded) {
            try {
                const res = await fetch('data/data.json');
                if (res.ok) {
                    const data = await res.json();

                    // Only overwrite if not already loaded from LS
                    if (!usersLoaded) {
                        this.state.users = data.users || [];
                        // Fallback defaults if JSON empty
                        if (this.state.users.length === 0) {
                            this.state.users = [
                                { username: 'admin', password: '123', role: 'admin' },
                                { username: 'user', password: '123', role: 'user' }
                            ];
                        }
                    }

                    if (!ordersLoaded) {
                        this.state.orders = data.orders || [];
                    }

                    this.saveData(); // Save normalized data
                    console.log('DB: Initialized missing data from defaults');
                }
            } catch (e) {
                console.error('DB: Failed to load defaults.', e);
                // Emergency defaults
                if (!usersLoaded) {
                    this.state.users = [
                        { username: 'admin', password: '123', role: 'admin' },
                        { username: 'user', password: '123', role: 'user' }
                    ];
                }
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

    updateUser(username, updates) {
        const user = this.state.users.find(u => u.username === username);
        if (!user) throw new Error('User not found');
        Object.assign(user, updates);
        this.saveData();
    },

    authenticate(username, password) {
        console.log(`DB: Authenticating ${username} with ${password}`);
        console.log('DB: Current Users:', this.state.users);

        // Emergency Fallback: If no users exist at all, create defaults immediately
        if (!this.state.users || this.state.users.length === 0) {
            console.warn('DB: No users found during auth. Restoring defaults.');
            this.state.users = [
                { username: 'admin', password: '123', role: 'admin' },
                { username: 'user', password: '123', role: 'user' }
            ];
            this.saveData();
        }

        const user = this.state.users.find(u => u.username === username && u.password === password);

        if (user) {
            console.log('DB: Auth successful', user);
            return { username: user.username, role: user.role };
        }

        console.warn('DB: Auth failed for', username);
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

/**
 * Database Module (db.js) - Refactored for Supabase
 * Handles data persistence using Supabase Cloud Database.
 * All methods are now ASYNC.
 */

import { supabaseClient } from './supabase-client.js';

const DB = {
    state: {
        users: [],
        orders: []
    },

    async init() {
        console.log('DB: Initializing Supabase...');
        if (!supabaseClient) {
            throw new Error('Supabase SDK konnte nicht geladen werden. Bitte Internetverbindung prüfen und Seite neu laden.');
        }
        await this.refreshData();
        console.log('DB: Data loaded from Cloud');
    },

    async refreshData() {
        const { data: users, error: userError } = await supabaseClient.from('users').select('*');
        if (userError) console.error('DB: Error fetching users', userError);
        else this.state.users = users || [];

        const { data: orders, error: orderError } = await supabaseClient.from('orders').select('*');
        if (orderError) console.error('DB: Error fetching orders', orderError);
        else this.state.orders = orders || [];
    },

    // --- Users ---
    getUsers() {
        return this.state.users;
    },

    async createUser(username, password) {
        if (this.state.users.find(u => u.username === username)) {
            throw new Error('Benutzer existiert bereits');
        }

        const newUser = { username, password, role: 'user' };

        // Optimistic Update
        this.state.users.push(newUser);

        const { error } = await supabaseClient.from('users').insert([newUser]);
        if (error) {
            console.error('DB: Create User Error', error);
            // Rollback
            this.state.users = this.state.users.filter(u => u.username !== username);
            throw new Error('Fehler beim Erstellen des Benutzers: ' + error.message);
        }
    },

    async deleteUser(username) {
        // Optimistic
        this.state.users = this.state.users.filter(u => u.username !== username);

        const { error } = await supabaseClient.from('users').delete().eq('username', username);
        if (error) {
            console.error('DB: Delete User Error', error);
            await this.refreshData(); // Rollback by refresh
        }
    },

    async updateUser(username, updates) {
        const user = this.state.users.find(u => u.username === username);
        if (!user) throw new Error('User not found');
        Object.assign(user, updates);

        const { error } = await supabaseClient.from('users').update(updates).eq('username', username);
        if (error) {
            console.error('DB: Update User Error', error);
            await this.refreshData();
        }
    },

    async authenticate(username, password) {
        // We can still use local state for fast auth checked against loaded users,
        // or strictly await fetch. For speed, we check local state (which is synced on init).
        // But to be safe against new users from other devices, let's re-fetch if not found?
        // Or just trust init() + realtime (future).
        // Let's rely on state populated by init().

        let user = this.state.users.find(u => u.username === username && u.password === password);

        if (!user) {
            // Try fetching fresh just in case
            const { data } = await supabaseClient.from('users').select('*').eq('username', username).eq('password', password).single();
            if (data) {
                user = data;
                // Update local list if missing
                if (!this.state.users.find(u => u.username === user.username)) {
                    this.state.users.push(user);
                }
            }
        }

        if (user) {
            console.log('DB: Auth successful', user);
            return { username: user.username, role: user.role };
        }
        return null;
    },

    // --- Session ---
    saveSession(user) {
        localStorage.setItem('session_v2', JSON.stringify({
            user,
            lastActive: Date.now()
        }));
    },

    getSession() {
        try {
            const data = localStorage.getItem('session_v2');
            if (!data) return null;
            const session = JSON.parse(data);
            const now = Date.now();
            if (now - session.lastActive > 900000) { // 15 min
                this.clearSession();
                return null;
            }
            session.lastActive = now;
            localStorage.setItem('session_v2', JSON.stringify(session));
            return session.user;
        } catch (e) {
            return null;
        }
    },

    updateSessionActivity() {
        const data = localStorage.getItem('session_v2');
        if (data) {
            const session = JSON.parse(data);
            session.lastActive = Date.now();
            localStorage.setItem('session_v2', JSON.stringify(session));
        }
    },

    clearSession() {
        localStorage.removeItem('session_v2');
    },

    // --- Orders ---
    getOrders() {
        return this.state.orders;
    },

    async saveOrder(order) {
        // Map app order object to DB schema
        // App uses: id, user, total, status, items, date, paid, adminNote
        // DB uses: id, user_id (FK), total, status, items (jsonb), date, paid, admin_note

        const dbOrder = {
            id: order.id,
            user_id: order.user,
            status: order.status,
            total: order.total,
            items: order.items,
            date: order.date,
            paid: order.paid || false,
            admin_note: order.adminNote || '',
            archived_by: order.archivedBy || [],
            deleted_by_admin: order.deletedByAdmin || false
        };

        this.state.orders.push(order); // Optimistic

        const { error } = await supabaseClient.from('orders').insert([dbOrder]);
        if (error) {
            console.error('DB: Save Order Error', error);
            this.state.orders = this.state.orders.filter(o => o.id !== order.id);
            throw new Error('Fehler beim Speichern der Bestellung');
        }
    },

    async updateOrder(id, mutator) {
        const order = this.state.orders.find(o => String(o.id) === String(id));
        if (order) {
            mutator(order); // Update local object in place

            // Prepare partial update for DB
            const dbUpdate = {};
            // Map fields back to DB columns
            if (order.status !== undefined) dbUpdate.status = order.status;
            if (order.paid !== undefined) dbUpdate.paid = order.paid;
            if (order.adminNote !== undefined) dbUpdate.admin_note = order.adminNote;
            if (order.deletedByAdmin !== undefined) dbUpdate.deleted_by_admin = order.deletedByAdmin;
            if (order.archivedBy !== undefined) dbUpdate.archived_by = order.archivedBy;

            const { error } = await supabaseClient.from('orders').update(dbUpdate).eq('id', id);

            if (error) {
                console.error('DB: Update Order Error', error);
                await this.refreshData(); // Revert
            }
            return true;
        }
        return false;
    },

    async deleteOrder(id) {
        this.state.orders = this.state.orders.filter(o => String(o.id) !== String(id));

        const { error } = await supabaseClient.from('orders').delete().eq('id', id);
        if (error) {
            console.error('DB: Delete Order Error', error);
            await this.refreshData();
        }
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
        if (maxId === 0) maxId = 1000;
        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

window.DB = DB;
export { DB };

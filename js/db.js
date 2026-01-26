/**
 * Database Module (db.js) - Refactored for Supabase & Cloud Cart & ID Logic v2 & Pricing
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
        // Users
        const { data: users, error: userError } = await supabaseClient.from('users').select('*');
        if (userError) console.error('DB: Error fetching users', userError);
        else {
            this.state.users = (users || []).map(u => ({
                username: u.username,
                password: u.password,
                role: u.role,
                cart: u.cart,
                isPablo: u.is_pablo // Map is_pablo -> isPablo
            }));
        }

        // Orders - Map DB snake_case to App camelCase
        const { data: orders, error: orderError } = await supabaseClient.from('orders').select('*');
        if (orderError) console.error('DB: Error fetching orders', orderError);
        else {
            this.state.orders = (orders || []).map(o => ({
                id: o.id,
                user: o.user_id,
                total: o.total,
                status: o.status,
                items: o.items,
                date: o.date,
                paid: o.paid,
                adminNote: o.admin_note,
                note: o.note,
                archivedBy: o.archived_by || [],
                deletedByAdmin: o.deleted_by_admin,
                adminArchived: o.admin_archived
            }));
        }
    },

    // --- Users ---
    getUsers() {
        return this.state.users;
    },

    async createUser(username, password) {
        if (this.state.users.find(u => u.username === username)) {
            throw new Error('Benutzer existiert bereits');
        }

        const newUser = { username, password, role: 'user', cart: [], is_pablo: false };

        // Optimistic
        this.state.users.push({ ...newUser, isPablo: false });

        const { error } = await supabaseClient.from('users').insert([newUser]);
        if (error) {
            console.error('DB: Create User Error', error);
            await this.refreshData(); // Revert
            throw new Error('Fehler beim Erstellen des Benutzers: ' + error.message);
        }
    },

    async deleteUser(username) {
        this.state.users = this.state.users.filter(u => u.username !== username);
        const { error } = await supabaseClient.from('users').delete().eq('username', username);
        if (error) {
            console.error('DB: Delete User Error', error);
            await this.refreshData();
        }
    },

    async updateUser(username, updates) {
        const user = this.state.users.find(u => u.username === username);
        if (!user) throw new Error('User not found');
        Object.assign(user, updates);

        const dbUpdates = {};
        if (updates.role) dbUpdates.role = updates.role;
        if (updates.password) dbUpdates.password = updates.password;
        if (updates.cart) dbUpdates.cart = updates.cart;
        if (updates.isPablo !== undefined) dbUpdates.is_pablo = updates.isPablo;

        const { error } = await supabaseClient.from('users').update(dbUpdates).eq('username', username);
        if (error) {
            console.error('DB: Update User Error', error);
            await this.refreshData();
        } else {
            // SUCCESS: Refresh local state from DB to be sure!
            await this.refreshData();
        }
    },

    // --- Cart Cloud Sync ---
    async saveCart(username, cart) {
        if (!username) return;
        const user = this.state.users.find(u => u.username === username);
        if (user) user.cart = cart;

        const { error } = await supabaseClient.from('users').update({ cart: cart }).eq('username', username);
        if (error) console.error('DB: Save Cart Error', error);
    },

    async authenticate(username, password) {
        let user = this.state.users.find(u => u.username === username && u.password === password);

        if (!user) {
            const { data } = await supabaseClient.from('users').select('*').eq('username', username).eq('password', password).single();
            if (data) {
                user = {
                    username: data.username,
                    password: data.password,
                    role: data.role,
                    cart: data.cart,
                    isPablo: data.is_pablo
                };
                if (!this.state.users.find(u => u.username === user.username)) {
                    this.state.users.push(user);
                }
            }
        }

        if (user) {
            console.log('DB: Auth successful', user);
            return { username: user.username, role: user.role, cart: user.cart || [], isPablo: user.isPablo };
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
            if (now - session.lastActive > 900000) {
                this.clearSession();
                return null;
            }
            session.lastActive = now;
            localStorage.setItem('session_v2', JSON.stringify(session));

            const freshUser = this.state.users.find(u => u.username === session.user.username);
            return freshUser || session.user;
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
        const dbOrder = {
            id: order.id,
            user_id: order.user,
            status: order.status,
            total: order.total,
            items: order.items,
            date: order.date,
            paid: order.paid || false,
            admin_note: order.adminNote || '',
            note: order.note || '',
            archived_by: order.archivedBy || [],
            deleted_by_admin: order.deletedByAdmin || false,
            admin_archived: order.adminArchived || false
        };

        this.state.orders.push(order);

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
            mutator(order);

            const dbUpdate = {};
            if (order.status !== undefined) dbUpdate.status = order.status;
            if (order.paid !== undefined) dbUpdate.paid = order.paid;
            if (order.adminNote !== undefined) dbUpdate.admin_note = order.adminNote;
            if (order.deletedByAdmin !== undefined) dbUpdate.deleted_by_admin = order.deletedByAdmin;
            if (order.archivedBy !== undefined) dbUpdate.archived_by = order.archivedBy;
            if (order.adminArchived !== undefined) dbUpdate.admin_archived = order.adminArchived;

            const { error } = await supabaseClient.from('orders').update(dbUpdate).eq('id', id);

            if (error) {
                console.error('DB: Update Order Error', error);
                await this.refreshData();
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
            const strId = String(editingId);
            if (strId.endsWith('B')) return strId;
            return strId + 'B';
        }

        let maxId = 0;
        this.state.orders.forEach(o => {
            const numPart = parseInt(String(o.id).replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) {
                maxId = numPart;
            }
        });

        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

window.DB = DB;
export { DB };

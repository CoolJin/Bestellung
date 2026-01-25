/**
 * Database Module (db.js) - Refactored for Supabase & Cloud Cart & ID Logic v2
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
        else this.state.users = users || [];

        // Orders - Map DB snake_case to App camelCase
        const { data: orders, error: orderError } = await supabaseClient.from('orders').select('*');
        if (orderError) console.error('DB: Error fetching orders', orderError);
        else {
            this.state.orders = (orders || []).map(o => ({
                id: o.id,
                user: o.user_id, // Map user_id -> user
                total: o.total,
                status: o.status,
                items: o.items, // jsonb
                date: o.date,
                paid: o.paid,
                adminNote: o.admin_note, // Map admin_note -> adminNote
                note: o.note,
                archivedBy: o.archived_by || [],
                deletedByAdmin: o.deleted_by_admin,
                adminArchived: o.admin_archived // Map admin_archived -> adminArchived
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

        const newUser = { username, password, role: 'user', cart: [] };

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

    // --- Cart Cloud Sync ---
    async saveCart(username, cart) {
        if (!username) return;
        // Find local user and update state immediately (Optimistic UI for session consistency)
        const user = this.state.users.find(u => u.username === username);
        if (user) user.cart = cart;

        const { error } = await supabaseClient.from('users').update({ cart: cart }).eq('username', username);
        if (error) console.error('DB: Save Cart Error', error);
    },

    async authenticate(username, password) {
        let user = this.state.users.find(u => u.username === username && u.password === password);

        if (!user) {
            // Try fetching fresh just in case
            const { data } = await supabaseClient.from('users').select('*').eq('username', username).eq('password', password).single();
            if (data) {
                user = data;
                if (!this.state.users.find(u => u.username === user.username)) {
                    this.state.users.push(user);
                }
            }
        }

        if (user) {
            console.log('DB: Auth successful', user);
            // Return full user object including cart
            return { username: user.username, role: user.role, cart: user.cart || [] };
        }
        return null;
    },

    // --- Session ---
    saveSession(user) {
        localStorage.setItem('session_v2', JSON.stringify({
            user, // This snapshot might have old cart, so we prefer refreshing from state on load
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

            // Refresh User Data (Cart) from State (which is fresh from Cloud)
            const freshUser = this.state.users.find(u => u.username === session.user.username);

            // If user found in fresh state, return THAT (contains syncd cart)
            // If not found (rare race condition if init failed?), return session user backup
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
            note: order.note || '', // Mapped from order.note
            archived_by: order.archivedBy || [],
            deleted_by_admin: order.deletedByAdmin || false,
            admin_archived: order.adminArchived || false // New Field
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
                await this.refreshData(); // Revert
            }
            return true;
        }
        return false;
    },

    async deleteOrder(id) {
        // Soft delete (or Admin Archive) maps to 'deleted' status?
        // User asked for "Trash" folder.
        // If we "Delete" permanently from the "Archive" folder -> Real Delete.

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
            // Logic for edits: Append B, but if already ends in B, keep it (don't stack B's)
            const strId = String(editingId);
            if (strId.endsWith('B')) return strId;
            return strId + 'B';
        }

        // Logic for New Orders: Scan MAX ID and Increment
        // Start at 1 (0001)
        let maxId = 0;
        this.state.orders.forEach(o => {
            // Strip non-digits (remove #, B, C...)
            const numPart = parseInt(String(o.id).replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) {
                maxId = numPart;
            }
        });

        // If no orders, maxId is 0. Next is 1.
        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

window.DB = DB;
export { DB };

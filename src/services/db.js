import { supabaseClient } from './supabase';

export const DB = {
    async fetchUsers() {
        const { data: users, error } = await supabaseClient.from('users').select('*');
        if (error) {
            console.error('DB: Error fetching users', error);
            return [];
        }
        return (users || []).map(u => ({
            username: u.username,
            password: u.password,
            role: u.role,
            cart: u.cart,
            isPablo: u.is_pablo
        }));
    },

    async fetchOrders() {
        const { data: orders, error } = await supabaseClient.from('orders').select('*');
        if (error) {
            console.error('DB: Error fetching orders', error);
            return { orders: [], adminExtras: [] };
        }
        const rawOrders = (orders || []).map(o => ({
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

        const adminExtras = rawOrders.find(o => o.id === '#ADMIN_EXTRAS')?.items || [];
        const cleanOrders = rawOrders.filter(o => o.id !== '#ADMIN_EXTRAS');
        return { orders: cleanOrders, adminExtras };
    },

    async saveAdminExtras(items, currentUsername) {
        if (!currentUsername) throw new Error("No Session");
        const specialOrder = {
            id: '#ADMIN_EXTRAS',
            user_id: currentUsername,
            status: 'hidden',
            items: items,
            total: 0,
            date: new Date().toISOString()
        };
        const { error } = await supabaseClient.from('orders').upsert([specialOrder]);
        if (error) throw error;
        return items;
    },

    async createUser(username, password) {
        const newUser = { username, password, role: 'user', cart: [], is_pablo: false };
        const { error } = await supabaseClient.from('users').insert([newUser]);
        if (error) throw new Error('Fehler beim Erstellen des Benutzers: ' + error.message);
    },

    async deleteUser(username) {
        await supabaseClient.from('users').delete().eq('username', username);
    },

    async updateUser(username, updates) {
        const dbUpdates = {};
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.password !== undefined) dbUpdates.password = updates.password;
        if (updates.cart !== undefined) dbUpdates.cart = updates.cart;
        if (updates.isPablo !== undefined) dbUpdates.is_pablo = updates.isPablo;
        
        await supabaseClient.from('users').update(dbUpdates).eq('username', username);
    },

    async saveCart(username, cart) {
        if (!username) return;
        await supabaseClient.from('users').update({ cart: cart }).eq('username', username);
    },

    async authenticate(username, password) {
        const { data } = await supabaseClient.from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();
            
        if (data) {
            return {
                username: data.username,
                password: data.password,
                role: data.role,
                cart: data.cart || [],
                isPablo: data.is_pablo
            };
        }
        return null;
    },

    // Orders
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

        const { error } = await supabaseClient.from('orders').insert([dbOrder]);
        if (error) {
            throw new Error('Speichern fehlgeschlagen: ' + (error.message || error.details || JSON.stringify(error)));
        }
    },

    async updateOrder(id, orderData) {
        const dbUpdate = {};
        if (orderData.status !== undefined) dbUpdate.status = orderData.status;
        if (orderData.paid !== undefined) dbUpdate.paid = orderData.paid;
        if (orderData.adminNote !== undefined) dbUpdate.admin_note = orderData.adminNote;
        if (orderData.deletedByAdmin !== undefined) dbUpdate.deleted_by_admin = orderData.deletedByAdmin;
        if (orderData.archivedBy !== undefined) dbUpdate.archived_by = orderData.archivedBy;
        if (orderData.adminArchived !== undefined) dbUpdate.admin_archived = orderData.adminArchived;
        if (orderData.items !== undefined) dbUpdate.items = orderData.items;

        await supabaseClient.from('orders').update(dbUpdate).eq('id', id);
    },

    async deleteOrder(id) {
        await supabaseClient.from('orders').delete().eq('id', id);
    },

    generateOrderId(existingOrders = [], editingId = null) {
        if (editingId) {
            const strId = String(editingId);
            if (strId.endsWith('B')) return strId;
            return strId + 'B';
        }

        let maxId = 0;
        existingOrders.forEach(o => {
            const numPart = parseInt(String(o.id).replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxId && numPart < 90000) {
                maxId = numPart;
            }
        });

        const newIdNum = maxId + 1;
        return '#' + String(newIdNum).padStart(4, '0');
    }
};

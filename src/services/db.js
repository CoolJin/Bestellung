import { supabaseClient, createIsolatedClient } from './supabase';

/**
 * Die Accounts liegen in Supabase Auth, das eine E-Mail-Adresse verlangt.
 * Angemeldet wird sich weiterhin mit dem Benutzernamen - daraus wird intern
 * eine feste Adresse gebaut. An diese Domain wird nie etwas zugestellt.
 */
const EMAIL_DOMAIN = 'sns.local';
export const emailForUsername = (username) =>
    `${String(username).trim().toLowerCase()}@${EMAIL_DOMAIN}`;

const mapProfile = (p) => p && ({
    id: p.id,
    username: p.username,
    role: p.role,
    isPablo: p.is_pablo,
    cart: p.cart || [],
});

const mapOrder = (o) => ({
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
    adminArchived: o.admin_archived,
});

export const DB = {
    // -----------------------------------------------------------------
    // Authentifizierung
    // -----------------------------------------------------------------
    async signIn(username, password) {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: emailForUsername(username),
            password,
        });
        if (error) return null;
        return await DB.fetchMyProfile();
    },

    async signOut() {
        await supabaseClient.auth.signOut();
    },

    /** Profil des angemeldeten Benutzers, oder null wenn keine Session aktiv ist. */
    async fetchMyProfile() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('DB: Profil konnte nicht geladen werden', error);
            return null;
        }
        return mapProfile(data);
    },

    // -----------------------------------------------------------------
    // Benutzerverwaltung (nur Admin - die Policies erzwingen das)
    // -----------------------------------------------------------------
    async fetchUsers() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('username');

        if (error) {
            console.error('DB: Benutzer konnten nicht geladen werden', error);
            return [];
        }
        return (data || []).map(mapProfile);
    },

    async createUser(username, password) {
        const clean = String(username).trim();
        if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(clean)) {
            throw new Error('Benutzername: 3-32 Zeichen, nur Buchstaben, Ziffern, . _ -');
        }
        if (!password || password.length < 8) {
            throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');
        }

        // Eigener Client, damit die Session des Admins erhalten bleibt.
        const signupClient = createIsolatedClient();
        const { error } = await signupClient.auth.signUp({
            email: emailForUsername(clean),
            password,
            options: { data: { username: clean } },
        });

        if (error) {
            if (/already registered|already exists/i.test(error.message)) {
                throw new Error(`Der Benutzer "${clean}" existiert bereits.`);
            }
            throw new Error('Benutzer konnte nicht erstellt werden: ' + error.message);
        }

        // Klartext-Kopie für die Anzeige im Adminbereich (nur Admins lesbar).
        // Schlägt das fehl, ist der Benutzer trotzdem angelegt - dann fehlt
        // lediglich die Anzeige.
        const { error: secretError } = await supabaseClient
            .from('user_secrets')
            .upsert({ username: clean, password, updated_at: new Date().toISOString() });
        if (secretError) {
            console.error('DB: Passwort-Anzeige konnte nicht gespeichert werden', secretError);
        }
    },

    async deleteUser(username) {
        const { error } = await supabaseClient.rpc('admin_delete_user', {
            target_username: username,
        });
        if (error) throw new Error('Löschen fehlgeschlagen: ' + error.message);
    },

    async setPassword(username, newPassword) {
        const { error } = await supabaseClient.rpc('admin_set_password', {
            target_username: username,
            new_password: newPassword,
        });
        if (error) throw new Error('Passwort konnte nicht geändert werden: ' + error.message);
    },

    /**
     * Passwörter für die Anzeige im Adminbereich.
     * Liefert { benutzername: passwort }. Für Konten, deren Passwort noch aus
     * der Zeit vor der Umstellung stammt, gibt es keinen Eintrag - diese
     * Passwörter liegen nur als Hash vor und sind nicht rückrechenbar.
     * Die Tabelle ist per RLS ausschließlich für Admins lesbar.
     */
    async fetchUserPasswords() {
        const { data, error } = await supabaseClient
            .from('user_secrets')
            .select('username, password');

        if (error) {
            console.error('DB: Passwörter konnten nicht geladen werden', error);
            return {};
        }
        return Object.fromEntries((data || []).map(r => [r.username, r.password]));
    },

    async updateUser(username, updates) {
        const dbUpdates = {};
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.cart !== undefined) dbUpdates.cart = updates.cart;
        if (updates.isPablo !== undefined) dbUpdates.is_pablo = updates.isPablo;

        const { error } = await supabaseClient
            .from('profiles')
            .update(dbUpdates)
            .eq('username', username);

        if (error) throw new Error('Änderung fehlgeschlagen: ' + error.message);
    },

    async saveCart(username, cart) {
        if (!username) return;
        const { error } = await supabaseClient
            .from('profiles')
            .update({ cart })
            .eq('username', username);
        if (error) console.error('DB: Warenkorb konnte nicht gespeichert werden', error);
    },

    // -----------------------------------------------------------------
    // Eigene Benachrichtigungseinstellungen
    // -----------------------------------------------------------------
    async fetchMySettings(username) {
        if (!username) return {};
        const { data, error } = await supabaseClient
            .from('settings')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (error) {
            console.error('DB: Einstellungen konnten nicht geladen werden', error);
            return {};
        }
        if (!data) return {};
        return {
            discordId: data.discord_id || '',
            notificationsEnabled: data.notifications_enabled !== false,
        };
    },

    async saveMySettings(username, settings) {
        if (!username) throw new Error('Keine Session');
        const { error } = await supabaseClient.from('settings').upsert({
            username,
            discord_id: settings.discordId || null,
            notifications_enabled: settings.notificationsEnabled !== false,
            updated_at: new Date().toISOString(),
        });
        if (error) throw new Error('Speichern fehlgeschlagen: ' + error.message);
        return settings;
    },

    // -----------------------------------------------------------------
    // Admin-Extras
    // -----------------------------------------------------------------
    async fetchAdminExtras() {
        const { data, error } = await supabaseClient
            .from('admin_extras')
            .select('items')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            console.error('DB: Extras konnten nicht geladen werden', error);
            return [];
        }
        return data?.items || [];
    },

    async saveAdminExtras(items) {
        const { error } = await supabaseClient
            .from('admin_extras')
            .update({ items, updated_at: new Date().toISOString() })
            .eq('id', 1);
        if (error) throw new Error('Extras konnten nicht gespeichert werden: ' + error.message);
        return items;
    },

    // -----------------------------------------------------------------
    // Bestellungen
    // -----------------------------------------------------------------
    async fetchOrders() {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('DB: Bestellungen konnten nicht geladen werden', error);
            return [];
        }
        return (data || []).map(mapOrder);
    },

    /** Fortlaufende Bestellnummer aus der Datenbank - kollisionsfrei. */
    async nextOrderId() {
        const { data, error } = await supabaseClient.rpc('next_order_id');
        if (error) throw new Error('Bestellnummer konnte nicht vergeben werden: ' + error.message);
        return data;
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
            admin_archived: order.adminArchived || false,
        };

        const { error } = await supabaseClient.from('orders').insert([dbOrder]);
        if (error) {
            throw new Error('Speichern fehlgeschlagen: ' + (error.message || error.details || 'unbekannter Fehler'));
        }
    },

    async updateOrder(id, orderData) {
        const dbUpdate = {};
        if (orderData.status !== undefined)         dbUpdate.status = orderData.status;
        if (orderData.paid !== undefined)           dbUpdate.paid = orderData.paid;
        if (orderData.adminNote !== undefined)      dbUpdate.admin_note = orderData.adminNote;
        if (orderData.deletedByAdmin !== undefined) dbUpdate.deleted_by_admin = orderData.deletedByAdmin;
        if (orderData.archivedBy !== undefined)     dbUpdate.archived_by = orderData.archivedBy;
        if (orderData.adminArchived !== undefined)  dbUpdate.admin_archived = orderData.adminArchived;
        if (orderData.items !== undefined)          dbUpdate.items = orderData.items;
        if (orderData.total !== undefined)          dbUpdate.total = orderData.total;
        if (orderData.note !== undefined)           dbUpdate.note = orderData.note;
        if (orderData.date !== undefined)           dbUpdate.date = orderData.date;

        const { error } = await supabaseClient.from('orders').update(dbUpdate).eq('id', id);
        if (error) throw new Error('Änderung fehlgeschlagen: ' + error.message);
    },

    async deleteOrder(id) {
        const { error } = await supabaseClient.from('orders').delete().eq('id', id);
        if (error) throw new Error('Löschen fehlgeschlagen: ' + error.message);
    },
};

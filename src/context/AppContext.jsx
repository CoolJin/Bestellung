import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DB } from '../services/db';
import { supabaseClient } from '../services/supabase';

const AppContext = createContext();

/** Nach dieser Zeit ohne Interaktion wird automatisch abgemeldet. */
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const LAST_ACTIVE_KEY = 'sns-last-active';

export const AppProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [adminExtras, setAdminExtras] = useState([]);
    const [mySettings, setMySettings] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

    // Bestellung, die gerade bearbeitet wird (siehe Profil > Bearbeiten).
    const [editingOrderId, setEditingOrderId] = useState(null);

    // -----------------------------------------------------------------
    // Daten laden
    // -----------------------------------------------------------------
    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;

        const [fetchedOrders, fetchedExtras, fetchedSettings] = await Promise.all([
            DB.fetchOrders(),
            DB.fetchAdminExtras(),
            DB.fetchMySettings(currentUser.username),
        ]);

        setOrders(fetchedOrders);
        setAdminExtras(fetchedExtras);
        setMySettings(fetchedSettings || {});
    }, [currentUser]);

    // -----------------------------------------------------------------
    // Session herstellen und auf Auth-Wechsel reagieren
    // -----------------------------------------------------------------
    useEffect(() => {
        let active = true;

        const init = async () => {
            try {
                const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
                if (lastActive && Date.now() - lastActive > INACTIVITY_LIMIT_MS) {
                    await DB.signOut();
                    localStorage.removeItem(LAST_ACTIVE_KEY);
                } else {
                    const profile = await DB.fetchMyProfile();
                    if (active && profile) {
                        setCurrentUser(profile);
                        setCart(profile.cart || []);
                    }
                }
            } catch (e) {
                console.error('Session konnte nicht wiederhergestellt werden', e);
            } finally {
                if (active) setIsLoaded(true);
            }
        };
        init();

        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setCart([]);
                setOrders([]);
                setAdminExtras([]);
                setMySettings({});
                setEditingOrderId(null);
            }
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    // Sobald ein Benutzer da ist: Daten holen.
    // (Laden beim Mounten ist genau der Zweck eines Effects - die Regel
    //  kann hier nicht sehen, dass der State erst nach dem await gesetzt wird.)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (currentUser) fetchAllData();
    }, [currentUser, fetchAllData]);

    // -----------------------------------------------------------------
    // Automatische Abmeldung nach Inaktivität
    // -----------------------------------------------------------------
    useEffect(() => {
        if (!currentUser) return;

        const touch = () => localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
        touch();

        const events = ['click', 'keydown', 'touchstart'];
        events.forEach(e => window.addEventListener(e, touch, { passive: true }));

        const interval = setInterval(async () => {
            const lastActive = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0);
            if (lastActive && Date.now() - lastActive > INACTIVITY_LIMIT_MS) {
                localStorage.removeItem(LAST_ACTIVE_KEY);
                await DB.signOut();
            }
        }, 30000);

        return () => {
            events.forEach(e => window.removeEventListener(e, touch));
            clearInterval(interval);
        };
    }, [currentUser]);

    // -----------------------------------------------------------------
    // Realtime: bei Änderungen einfach neu laden.
    // Die Discord-Benachrichtigungen verschickt die Datenbank selbst
    // (supabase/migrations/003) - früher tat das jeder offene Tab, was zu
    // mehrfachen DMs führte.
    // -----------------------------------------------------------------
    useEffect(() => {
        if (!currentUser) return;

        const channel = supabaseClient
            .channel('sns-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAllData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_extras' }, () => fetchAllData())
            .subscribe();

        return () => { supabaseClient.removeChannel(channel); };
    }, [currentUser, fetchAllData]);

    // -----------------------------------------------------------------
    // An- und Abmeldung
    // -----------------------------------------------------------------
    const login = async (username, password) => {
        const profile = await DB.signIn(username, password);
        if (!profile) return false;
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
        setCurrentUser(profile);
        setCart(profile.cart || []);
        return true;
    };

    const logout = async () => {
        localStorage.removeItem(LAST_ACTIVE_KEY);
        setEditingOrderId(null);
        await DB.signOut();
    };

    const saveSettings = async (settings) => {
        if (!currentUser) return;
        await DB.saveMySettings(currentUser.username, settings);
        setMySettings(await DB.fetchMySettings(currentUser.username));
    };

    // -----------------------------------------------------------------
    // Warenkorb - einzige Quelle der Wahrheit ist das Profil in der DB.
    // (Früher lag zusätzlich eine Kopie im localStorage, die nicht bei
    // jeder Änderung mitgezogen wurde - nach einem Reload war der
    // Warenkorb dann falsch.)
    // -----------------------------------------------------------------
    const persistCart = useCallback((newCart) => {
        setCart(newCart);
        if (currentUser) {
            DB.saveCart(currentUser.username, newCart);
        }
    }, [currentUser]);

    // Externe Produkte bekommen bei jeder Suche eine neue ID - daher
    // zusätzlich über den Namen abgleichen.
    const sameProduct = (a, b) =>
        a.id === b.id || (a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase());

    const addToCart = (product, quantity = 1) => {
        const existing = cart.find(p => sameProduct(p, product));
        const newCart = existing
            ? cart.map(p => sameProduct(p, product) ? { ...p, quantity: (p.quantity || 1) + quantity } : p)
            : [...cart, { ...product, quantity }];
        persistCart(newCart);
    };

    const changeCartQty = (id, delta) => {
        const existing = cart.find(p => p.id === id);
        if (!existing) return;
        const newCart = (existing.quantity + delta <= 0)
            ? cart.filter(p => p.id !== id)
            : cart.map(p => p.id === id ? { ...p, quantity: p.quantity + delta } : p);
        persistCart(newCart);
    };

    const clearCart = () => persistCart([]);

    /**
     * Bestellung zum Bearbeiten in den Warenkorb laden.
     * Die Bestellung bleibt dabei bestehen und wird beim Absenden
     * aktualisiert - bricht der Nutzer ab, geht nichts verloren.
     */
    const startEditingOrder = (order) => {
        setEditingOrderId(order.id);
        persistCart((order.items || []).map(item => ({ ...item, quantity: item.quantity || 1 })));
    };

    const cancelEditingOrder = () => {
        setEditingOrderId(null);
        persistCart([]);
    };

    // -----------------------------------------------------------------
    // Admin-Extras
    // -----------------------------------------------------------------
    const addToAdminExtras = async (product) => {
        try {
            const existing = adminExtras.find(p => sameProduct(p, product));
            const newExtras = existing
                ? adminExtras.map(p => sameProduct(p, product) ? { ...p, quantity: (p.quantity || 1) + 1 } : p)
                : [...adminExtras, { ...product, quantity: 1 }];

            await DB.saveAdminExtras(newExtras);
            setAdminExtras(newExtras);
        } catch (e) {
            console.error('Extras konnten nicht gespeichert werden', e);
        }
    };

    return (
        <AppContext.Provider value={{
            currentUser,
            cart,
            orders,
            adminExtras,
            isLoaded,
            mySettings,
            editingOrderId,
            login,
            logout,
            addToCart,
            addToAdminExtras,
            changeCartQty,
            clearCart,
            startEditingOrder,
            cancelEditingOrder,
            fetchAllData,
            saveSettings,
        }}>
            {children}
        </AppContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);

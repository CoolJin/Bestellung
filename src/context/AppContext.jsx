import React, { createContext, useContext, useState, useEffect } from 'react';
import { DB } from '../services/db';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [adminExtras, setAdminExtras] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const sessionData = localStorage.getItem('session_v3');
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    if (Date.now() - session.lastActive > 900000) {
                        localStorage.removeItem('session_v3');
                    } else {
                        session.lastActive = Date.now();
                        localStorage.setItem('session_v3', JSON.stringify(session));
                        setCurrentUser(session.user);
                        setCart(session.user.cart || []);
                    }
                }
            } catch (e) {
                console.error("Session parse error", e);
                localStorage.removeItem('session_v3');
            }

            try {
                await fetchAllData();
            } catch(e) {
                console.error("Fetch Data Error:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        init();

        const handleActivity = () => {
            const data = localStorage.getItem('session_v3');
            if (data) {
                const session = JSON.parse(data);
                session.lastActive = Date.now();
                localStorage.setItem('session_v3', JSON.stringify(session));
            }
        };

        window.addEventListener('click', handleActivity);
        window.addEventListener('keypress', handleActivity);
        return () => {
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('keypress', handleActivity);
        };
    }, []);

    const fetchAllData = async () => {
        const { orders: fetchedOrders, adminExtras: fetchedExtras } = await DB.fetchOrders();
        setOrders(fetchedOrders);
        setAdminExtras(fetchedExtras);
    };

    const login = async (username, password) => {
        const user = await DB.authenticate(username, password);
        if (user) {
            setCurrentUser(user);
            setCart(user.cart || []);
            localStorage.setItem('session_v3', JSON.stringify({ user, lastActive: Date.now() }));
            return true;
        }
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        setCart([]);
        localStorage.removeItem('session_v3');
    };

    // Dedup helper: match by name since external products get random IDs each search
    const sameProduct = (a, b) =>
        a.id === b.id || (a.name && b.name && a.name.trim().toLowerCase() === b.name.trim().toLowerCase());

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(p => sameProduct(p, product));
            let newCart;
            if (existing) {
                newCart = prev.map(p => sameProduct(p, product) ? { ...p, quantity: p.quantity + quantity } : p);
            } else {
                newCart = [...prev, { ...product, quantity }];
            }
            if (currentUser) DB.saveCart(currentUser.username, newCart);
            const sessionData = localStorage.getItem('session_v3');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                session.user.cart = newCart;
                localStorage.setItem('session_v3', JSON.stringify(session));
            }
            return newCart;
        });
    };

    const changeCartQty = (id, delta) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === id);
            if (!existing) return prev;
            let newCart;
            if (existing.quantity + delta <= 0) {
                newCart = prev.filter(p => p.id !== id);
            } else {
                newCart = prev.map(p => p.id === id ? { ...p, quantity: p.quantity + delta } : p);
            }
            if (currentUser) DB.saveCart(currentUser.username, newCart);
            return newCart;
        });
    };

    const clearCart = () => {
        setCart([]);
        if (currentUser) DB.saveCart(currentUser.username, []);
    };

    // Add product to Admin Extras (admin-only separate basket)
    const addToAdminExtras = async (product) => {
        try {
            const current = [...adminExtras];
            const existing = current.find(p => sameProduct(p, product));
            let newExtras;
            if (existing) {
                newExtras = current.map(p => sameProduct(p, product) ? { ...p, quantity: (p.quantity || 1) + 1 } : p);
            } else {
                newExtras = [...current, { ...product, quantity: 1 }];
            }
            await DB.saveAdminExtras(newExtras, currentUser.username);
            setAdminExtras(newExtras);
        } catch (e) {
            console.error('addToAdminExtras failed', e);
        }
    };

    return (
        <AppContext.Provider value={{
            currentUser,
            cart,
            orders,
            adminExtras,
            isLoaded,
            login,
            logout,
            addToCart,
            addToAdminExtras,
            changeCartQty,
            clearCart,
            fetchAllData
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);

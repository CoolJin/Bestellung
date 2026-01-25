// --- js/modules/auth.js ---
import { UI } from './ui.js';

export const Auth = {
    checkSession(DB, state, updateUI, navigateTo, currentView) {
        const user = DB.getSession();
        if (user) {
            state.currentUser = user;
            // Load cart from user object (synced in db.js getSession)
            state.cart = user.cart || [];
            updateUI();

            // Redirect logic
            if (currentView === 'login') {
                navigateTo(user.role === 'admin' ? 'admin' : 'catalog');
            } else {
                navigateTo(currentView);
            }
        } else {
            navigateTo('login');
        }
    },

    async login(username, password, DB, state, navigateTo, updateUI, elements) {
        elements.loginError.textContent = '';
        const btn = elements.loginForm.querySelector('button');
        btn.textContent = 'Lade...';
        btn.disabled = true;

        try {
            const user = await DB.authenticate(username, password);
            if (user) {
                state.currentUser = user;
                // Load cloud cart
                state.cart = user.cart || [];

                DB.saveSession(user);
                navigateTo(user.role === 'admin' ? 'admin' : 'catalog');
                updateUI();
            } else {
                elements.loginError.textContent = 'Ungültige Anmeldedaten';
            }
        } catch (e) {
            elements.loginError.textContent = 'Login Fehler: ' + e.message;
        } finally {
            btn.textContent = 'Anmelden';
            btn.disabled = false;
        }
    },

    logout(DB, state, navigateTo, updateUI) {
        state.currentUser = null;
        state.cart = []; // Clear Cart locally
        DB.clearSession();
        navigateTo('login');
        updateUI();
    },

    async handleCreateUser(e, DB, elements) {
        e.preventDefault();
        if (!elements.newUsername || !elements.newPassword) return;
        try {
            await DB.createUser(elements.newUsername.value, elements.newPassword.value);
            elements.adminMsg.textContent = 'Benutzer erstellt!';
            elements.adminMsg.style.color = 'var(--primary-color)';
            e.target.reset();
        } catch (err) {
            elements.adminMsg.textContent = err.message;
            elements.adminMsg.style.color = 'red';
        }
    }
};

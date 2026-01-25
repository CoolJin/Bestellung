// --- js/modules/auth.js ---
export const Auth = {
    checkSession(DB, state, updateUI, navigateTo, currentView) {
        const user = DB.getSession();
        if (user) {
            state.currentUser = user;
            updateUI();
            if (currentView === 'login') {
                navigateTo(user.role === 'admin' ? 'admin' : 'catalog');
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

        // Artificial delay removed or kept? DB call takes time anyway. 
        // We can keep the structure but await DB.

        try {
            const user = await DB.authenticate(username, password);
            if (user) {
                state.currentUser = user;
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
        DB.clearSession();
        state.currentUser = null;
        state.cart = [];
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
            elements.adminMsg.style.color = '#ef4444';
        }
    }
};

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

    login(username, password, DB, state, navigateTo, updateUI, elements) {
        elements.loginError.textContent = '';
        const btn = elements.loginForm.querySelector('button');
        btn.textContent = 'Lade...';
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = 'Anmelden';
            btn.disabled = false;

            const user = DB.authenticate(username, password);
            if (user) {
                state.currentUser = user;
                DB.saveSession(user);
                navigateTo(user.role === 'admin' ? 'admin' : 'catalog');
                updateUI();
            } else {
                elements.loginError.textContent = 'Ungültige Anmeldedaten';
            }
        }, 500);
    },

    logout(DB, state, navigateTo, updateUI) {
        DB.clearSession();
        state.currentUser = null;
        state.cart = [];
        navigateTo('login');
        updateUI();
    },

    handleCreateUser(e, DB, elements) {
        e.preventDefault();
        if (!elements.newUsername || !elements.newPassword) return;
        try {
            DB.createUser(elements.newUsername.value, elements.newPassword.value);
            elements.adminMsg.textContent = 'Benutzer erstellt!';
            elements.adminMsg.style.color = 'var(--primary-color)';
            e.target.reset();
        } catch (err) {
            elements.adminMsg.textContent = err.message;
            elements.adminMsg.style.color = '#ef4444';
        }
    }
};

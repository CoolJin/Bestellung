// --- js/modules/ui/core.js ---
export const CoreUI = {
    showModal(title, msg) {
        const existing = document.querySelector('.notification-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'notification-modal';
        modal.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-msg">${msg}</div>
                <glass-surface class="btn btn-primary" onclick="this.closest('.notification-modal').remove()">Ok</glass-surface>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => {
            if (modal && modal.parentElement) modal.remove();
        }, 3000);
    },

    showConfirm(title, msg, onConfirm) {
        const existing = document.getElementById('custom-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content glass-panel">
                <h3>${title}</h3>
                <p>${msg}</p>
                <div class="modal-actions">
                    <glass-surface class="btn btn-secondary" onclick="this.closest('.modal').remove()">Abbrechen</glass-surface>
                    <glass-surface class="btn btn-primary" id="confirm-yes-btn">Ja</glass-surface>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('confirm-yes-btn').onclick = () => {
            onConfirm();
            modal.remove();
        };
    }
};

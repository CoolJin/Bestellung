import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function NotificationModal({ isOpen, onClose }) {
    const { currentUser, userSettings, saveSettings } = useAppContext();
    const [discordIdInput, setDiscordIdInput] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && currentUser && userSettings[currentUser.username]) {
            setDiscordIdInput(userSettings[currentUser.username].discordId || '');
            setNotificationsEnabled(userSettings[currentUser.username].notificationsEnabled !== false);
        }
    }, [isOpen, currentUser, userSettings]);

    if (!isOpen) return null;

    const currentSavedDiscordId = userSettings[currentUser.username]?.discordId || '';
    const currentSavedEnabled = userSettings[currentUser.username]?.notificationsEnabled !== false;

    const hasChanges = discordIdInput.trim() !== currentSavedDiscordId || notificationsEnabled !== currentSavedEnabled;

    const handleSave = async () => {
        if (!hasChanges) return;
        setIsSaving(true);
        try {
            await saveSettings({ 
                discordId: discordIdInput.trim(),
                notificationsEnabled: notificationsEnabled 
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch(e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
            <div className="glass-panel modal-content slide-up" onClick={e => e.stopPropagation()} style={{
                background: 'var(--color-surface)', width: '100%', maxWidth: '500px', 
                borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Bell size={20} style={{ color: 'var(--color-accent)' }} />
                        Benachrichtigungseinstellungen
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                        <X size={20} />
                    </button>
                </div>
                
                <div style={{ padding: '1.5rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                        Verbinde deinen Account mit Discord, um bei {currentUser.role === 'admin' ? 'neuen Produktanfragen' : 'Status-Updates'} direkt eine private Nachricht zu erhalten.
                    </p>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
                            Discord User-ID
                        </label>
                        <input 
                            type="text" 
                            className="input-field" 
                            value={discordIdInput} 
                            onChange={(e) => setDiscordIdInput(e.target.value)} 
                            placeholder="z.B. 123456789012345678" 
                            style={{ 
                                width: '100%', 
                                padding: '0.75rem 1rem', 
                                background: 'rgba(0,0,0,0.2)', 
                                border: '1px solid var(--color-border)', 
                                borderRadius: 'var(--radius)', 
                                color: 'var(--color-foreground)',
                                fontSize: '1rem'
                            }} 
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                            <strong>So findest du deine ID:</strong> Discord-Einstellungen &gt; Erweitert &gt; Entwicklermodus aktivieren. Danach Rechtsklick auf dein Profilbild und "ID kopieren".
                        </p>
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--color-border)',
                        marginBottom: '1.5rem'
                    }}>
                        <div>
                            <div style={{ fontWeight: '500', fontSize: '0.95rem' }}>Benachrichtigungen aktivieren</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                                Schalte Benachrichtigungen temporär ein oder aus
                            </div>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                            <input 
                                type="checkbox" 
                                checked={notificationsEnabled}
                                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: notificationsEnabled ? 'var(--color-accent)' : 'var(--color-border)',
                                transition: '.3s', borderRadius: '24px'
                            }}>
                                <span style={{
                                    position: 'absolute', content: '""', height: '18px', width: '18px',
                                    left: notificationsEnabled ? '22px' : '3px', bottom: '3px',
                                    backgroundColor: notificationsEnabled ? 'var(--color-background)' : 'white', 
                                    transition: '.3s', borderRadius: '50%'
                                }}></span>
                            </span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button onClick={onClose} className="btn-secondary" style={{ 
                            padding: '0.6rem 1.25rem', 
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-foreground)',
                            borderRadius: 'var(--radius)',
                            cursor: 'pointer'
                        }}>
                            Abbrechen
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving || (!hasChanges && !saveSuccess)}
                            className="btn-primary" 
                            style={{ 
                                padding: '0.6rem 1.25rem', 
                                background: saveSuccess ? 'var(--color-success)' : (hasChanges ? 'var(--color-accent)' : 'var(--color-surface)'),
                                border: hasChanges || saveSuccess ? 'none' : '1px solid var(--color-border)',
                                color: hasChanges || saveSuccess ? '#000' : 'var(--color-muted)',
                                borderRadius: 'var(--radius)',
                                fontWeight: '600',
                                cursor: (isSaving || (!hasChanges && !saveSuccess)) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isSaving ? 'Lädt...' : (saveSuccess ? <><CheckCircle size={16} /> Gespeichert</> : 'Speichern')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

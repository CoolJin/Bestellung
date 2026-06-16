import React from 'react';
import { Bell, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OnboardingModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleNavigate = () => {
        onClose();
        navigate('/profile');
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
            <div className="glass-panel modal-content slide-up" onClick={e => e.stopPropagation()} style={{
                background: 'var(--color-surface)', width: '100%', maxWidth: '450px', 
                borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(170, 59, 255, 0.3)',
                boxShadow: '0 25px 50px -12px rgba(170, 59, 255, 0.25)'
            }}>
                <div style={{ padding: '2rem', textAlign: 'center', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                        <X size={20} />
                    </button>

                    <div style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(170, 59, 255, 0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                        border: '1px solid rgba(170, 59, 255, 0.5)', boxShadow: '0 0 20px rgba(170, 59, 255, 0.3)'
                    }}>
                        <Bell size={32} style={{ color: 'var(--color-accent)' }} />
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--color-foreground)' }}>
                        Neues Benachrichtigungs-Feature!
                    </h2>
                    
                    <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                        Du kannst ab sofort deinen Account mit unserem Discord-Server verknüpfen. 
                        Erhalte **automatische Status-Updates** zu deinen Anfragen und Bestellungen direkt per privater Nachricht!
                    </p>

                    <button 
                        onClick={handleNavigate}
                        className="btn-primary" 
                        style={{ 
                            width: '100%', padding: '0.875rem', background: 'var(--color-accent)', 
                            color: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius)', 
                            fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', 
                            justifyContent: 'center', gap: '0.5rem', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Jetzt einrichten <ArrowRight size={18} />
                    </button>
                    
                    <button 
                        onClick={onClose}
                        style={{ 
                            marginTop: '1rem', background: 'none', border: 'none', 
                            color: 'var(--color-muted)', fontSize: '0.875rem', cursor: 'pointer' 
                        }}
                    >
                        Später vielleicht
                    </button>
                </div>
            </div>
        </div>
    );
}

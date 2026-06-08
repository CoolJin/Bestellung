import React, { useEffect } from 'react';
import { X } from 'lucide-react';export default function Modal({ isOpen, title, children, onClose, onConfirm, confirmText = "Bestätigen", confirmColor = "primary", isDanger = false, cancelText = "Abbrechen", centerButtons = false }) {// Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <style>
                {`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                `}
            </style>
            
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '0',
                overflow: 'hidden',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--color-border)'
                }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>{title}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>
                
                <div style={{ padding: '1.25rem' }}>
                    {children}
                </div>

                <div style={{
                    padding: '1rem 1.25rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: centerButtons ? 'center' : 'flex-end',
                    gap: '0.75rem'
                }}>
                    <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
                    {onConfirm && (
                        <button 
                            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} 
                            onClick={onConfirm}
                        >
                            {confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

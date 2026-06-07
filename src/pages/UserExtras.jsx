import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { calculatePrice, formatPrice } from '../services/pricing';

export default function UserExtras() {
    const { adminExtras, currentUser } = useAppContext();
    const navigate = useNavigate();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button 
                    onClick={() => navigate(-1)} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-fg)', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <ChevronLeft size={24} />
                </button>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Verfügbare Extras</h2>
            </div>

            {(!adminExtras || adminExtras.length === 0) ? (
                <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                    <p style={{ fontSize: '1.1rem' }}>Aktuell sind keine Extras verfügbar.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {adminExtras.map((product, idx) => {
                        const price = calculatePrice(product, currentUser);
                        
                        return (
                            <div key={idx} className="glass-panel product-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '80px', height: '80px', flexShrink: 0, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                                        <img 
                                            src={product.image || '/placeholder-image.png'} 
                                            alt={product.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem', lineHeight: '1.2' }}>{product.name}</h3>
                                        <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{product.brand || 'Extra'}</p>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                                        {formatPrice(price)}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.6rem', borderRadius: '12px' }}>
                                        Anzahl verfügbar: <strong style={{ color: 'var(--color-fg)' }}>{product.quantity || 0}</strong>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { calculateVK, formatPrice } from '../services/pricing';
import { ArrowLeft, ShoppingCart, Check } from 'lucide-react';
import GlassSurface from '../components/GlassSurface';

export default function UserExtras() {
    const navigate = useNavigate();
    const { adminExtras } = useAppContext();

    // Deduplicate extras based on ID or name, summing their quantities
    // Actually, users just view the available items (with their VK price)
    // adminExtras already is a deduped list of what the admin added.

    return (
        <div className="container page-transition" style={{ paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                <button
                    onClick={() => navigate('/home')}
                    style={{
                        background: 'none', border: 'none', color: 'var(--color-foreground)',
                        cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Verfügbare Extras</h1>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {adminExtras.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                        <p>Aktuell sind keine Extras verfügbar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
                        {adminExtras.map((item, idx) => {
                            const vk = calculateVK(item);

                            return (
                                <div key={idx} className="glass-panel product-card">
                                    <img src={item.image} alt={item.name} className="product-image" loading="lazy" />
                                    <div style={{ flex: 1, padding: '0.5rem 0' }}>
                                        <h3 className="product-title">{item.name}</h3>
                                        <p className="product-price" style={{ marginTop: '0.25rem' }}>
                                            {formatPrice(vk)}
                                        </p>
                                    </div>
                                    {/* Users cannot edit or add, just view, maybe a text saying "Vor Ort verfügbar" */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                                        Verfügbare Menge: {item.quantity}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

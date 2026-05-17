import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { DB } from '../services/db';
import { Minus, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react';
import { calculateVK, formatPrice } from '../services/pricing';

export default function AdminExtras() {
    const { adminExtras, currentUser, fetchAllData } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const totalEK = adminExtras.reduce((acc, item) => {
        return acc + Number(item.originalPrice || item.price || 0) * (item.quantity || 1);
    }, 0);

    const totalVK = adminExtras.reduce((acc, item) => {
        return acc + calculateVK(item) * (item.quantity || 1);
    }, 0);

    const totalProfit = totalVK - totalEK;
    const profitColor = totalProfit > 0 ? '#22c55e' : totalProfit < 0 ? '#ef4444' : 'var(--color-muted)';

    // Build copy text: {qty}x | "{name}" | {vk}€
    const handleCopy = () => {
        const lines = adminExtras.map(item => {
            const vk = calculateVK(item);
            return `${item.quantity || 1}x | ${item.name} | ${vk}€`;
        });
        const text = lines.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const getProductUrl = (item) => {
        if (item.handle) return `https://snuzone.com/products/${item.handle}`;
        return null;
    };

    const changeQuantity = async (index, delta) => {
        if (loading) return;
        setLoading(true);
        try {
            const newExtras = adminExtras.map(item => ({ ...item }));
            newExtras[index].quantity = (newExtras[index].quantity || 1) + delta;
            const finalExtras = newExtras[index].quantity <= 0
                ? newExtras.filter((_, i) => i !== index)
                : newExtras;
            await DB.saveAdminExtras(finalExtras, currentUser.username);
            await fetchAllData();
        } catch (e) {
            console.error('Fehler:', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontWeight: '600' }}>Admin Extras</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{adminExtras.length} Artikel</span>
                        {adminExtras.length > 0 && (
                            <button
                                className="btn btn-secondary"
                                onClick={handleCopy}
                                style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                {copied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Liste kopieren</>}
                            </button>
                        )}
                    </div>
                </div>

                {adminExtras.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-muted)' }}>
                        <p>Keine Extras vorhanden.</p>
                        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Gehe zur <strong>Suche</strong> und klicke "Zu Extras".</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {adminExtras.map((item, idx) => {
                            const ek = Number(item.originalPrice || item.price || 0);
                            const vk = calculateVK(item);
                            const profit = (vk - ek) * (item.quantity || 1);
                            const productUrl = getProductUrl(item);

                            return (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                                    <img src={item.image} alt={item.name} style={{ width: '44px', height: '44px', borderRadius: 'var(--radius)', objectFit: 'cover' }} />
                                    <div>
                                        {/* Clickable product name */}
                                        {productUrl ? (
                                            <a
                                                href={productUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-foreground)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-foreground)'}
                                            >
                                                {item.name}
                                                <ExternalLink size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
                                            </a>
                                        ) : (
                                            <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>{item.name}</h4>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                                            <span style={{ color: 'var(--color-muted)' }}>EK: {formatPrice(ek)}</span>
                                            <span style={{ color: 'var(--color-accent)' }}>VK: {formatPrice(vk)}</span>
                                            <span style={{ color: profit > 0 ? '#22c55e' : '#ef4444' }}>+{formatPrice(profit)}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius)' }}>
                                        <button onClick={() => changeQuantity(idx, -1)} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--color-foreground)', cursor: 'pointer', padding: '0.2rem' }}>
                                            {item.quantity === 1 ? <Trash2 size={14} color="var(--color-destructive)" /> : <Minus size={14} />}
                                        </button>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '1.25rem', textAlign: 'center' }}>{item.quantity}</span>
                                        <button onClick={() => changeQuantity(idx, 1)} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--color-foreground)', cursor: 'pointer', padding: '0.2rem' }}>
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Summary */}
                        <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--color-muted)' }}>Einkaufspreis Total (EK):</span>
                                <span>{formatPrice(totalEK)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '600' }}>
                                <span>Verkaufspreis Total (VK):</span>
                                <span style={{ color: 'var(--color-accent)' }}>{formatPrice(totalVK)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', fontWeight: '700' }}>
                                <span>Gewinn:</span>
                                <span style={{ color: profitColor }}>{formatPrice(totalProfit)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

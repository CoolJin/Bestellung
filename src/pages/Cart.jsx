import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { DB } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ShoppingCart } from 'lucide-react';
import { calculatePrice, calculateCartTotal, formatPrice } from '../services/pricing';

export default function Cart() {
    const { cart, currentUser, changeCartQty, clearCart, orders } = useAppContext();
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const total = calculateCartTotal(cart, currentUser);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        setError('');

        try {
            const orderId = DB.generateOrderId(orders);

            const itemsWithPrices = cart.map(item => ({
                ...item,
                price: calculatePrice(item, currentUser),
                originalPrice: Number(item.originalPrice || item.price || 0),
            }));

            const newOrder = {
                id: orderId,
                user: currentUser.username,
                status: 'open',
                items: itemsWithPrices,
                total: parseFloat(total.toFixed(2)),
                date: new Date().toISOString(),
                note: note.trim(),
            };

            await DB.saveOrder(newOrder);
            clearCart();
            navigate('/profile');
        } catch (err) {
            setError(err.message || 'Fehler beim Bestellen');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '6rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Warenkorb</h1>

            {error && (
                <div className="glass-panel mb-4" style={{ padding: '1rem', color: 'var(--color-destructive)', borderColor: 'var(--color-destructive)' }}>
                    {error}
                </div>
            )}

            {cart.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                    <ShoppingCart size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p>Dein Warenkorb ist leer.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        {cart.map((item) => {
                            const calcPrice = calculatePrice(item, currentUser);
                            return (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <img src={item.image} alt={item.name} style={{ width: '60px', height: '60px', borderRadius: 'var(--radius)', objectFit: 'cover', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h4 style={{ fontSize: '0.875rem', fontWeight: '500', lineHeight: 1.3 }}>{item.name}</h4>
                                        <span style={{ fontWeight: '700', fontSize: '0.9rem', marginTop: '0.25rem', display: 'block' }}>
                                            {formatPrice(calcPrice)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: 'var(--radius)', flexShrink: 0 }}>
                                        <button onClick={() => changeCartQty(item.id, -1)} style={{ background: 'none', border: 'none', color: 'var(--color-foreground)', cursor: 'pointer', padding: '0.25rem' }}>
                                            {item.quantity === 1 ? <Trash2 size={16} color="var(--color-destructive)" /> : <Minus size={16} />}
                                        </button>
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                                        <button onClick={() => changeCartQty(item.id, 1)} style={{ background: 'none', border: 'none', color: 'var(--color-foreground)', cursor: 'pointer', padding: '0.25rem' }}>
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="glass-panel" style={{ padding: '1rem' }}>
                        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Notiz zur Bestellung (Optional)</label>
                        <textarea
                            className="form-input w-full"
                            rows="3"
                            placeholder="Wünsche, Anmerkungen..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                                {cart.reduce((a, i) => a + i.quantity, 0)} Artikel
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatPrice(total)}</span>
                        </div>
                        <button
                            className="btn btn-primary w-full"
                            onClick={handleCheckout}
                            disabled={loading}
                            style={{ height: '3rem', fontSize: '1rem' }}
                        >
                            {loading
                                ? <span className="spinner" style={{ width: '1.2rem', height: '1.2rem', borderWidth: '2px' }}></span>
                                : <><ArrowRight size={20} /> Bestellung absenden</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

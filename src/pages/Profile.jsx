import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { DB } from '../services/db';
import { Package, RotateCcw, Archive, Trash2, Edit2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';

export default function Profile() {
    const { currentUser, orders, fetchAllData, clearCart, addToCart } = useAppContext();
    const navigate = useNavigate();

    // Confirm modal state
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, isDanger: false });
    const [isLagerModalOpen, setIsLagerModalOpen] = useState(false);

    const showConfirm = (title, message, onConfirm, isDanger = false) => {
        setConfirm({ open: true, title, message, onConfirm, isDanger });
    };

    const closeConfirm = () => setConfirm({ open: false, title: '', message: '', onConfirm: null, isDanger: false });

    const executeConfirm = async () => {
        if (confirm.onConfirm) await confirm.onConfirm();
        closeConfirm();
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const myOrders = orders.filter(o => {
        if (o.user !== currentUser.username) return false;
        if (o.deletedByAdmin) return false;
        const deletedTag = `DELETED:${currentUser.username}`;
        if (o.archivedBy && o.archivedBy.includes(deletedTag)) return false;
        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const doAction = async (orderId, action) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            if (action === 'cancel') {
                await DB.updateOrder(orderId, { status: 'cancelled' });
            } else if (action === 'archive') {
                const current = order.archivedBy || [];
                if (!current.includes(currentUser.username)) {
                    await DB.updateOrder(orderId, { archivedBy: [...current, currentUser.username] });
                }
            } else if (action === 'restore') {
                const current = (order.archivedBy || []).filter(u => u !== currentUser.username);
                await DB.updateOrder(orderId, { archivedBy: current, status: 'open' });
            } else if (action === 'delete') {
                let current = (order.archivedBy || []).filter(u => u !== currentUser.username);
                current.push(`DELETED:${currentUser.username}`);
                await DB.updateOrder(orderId, { archivedBy: current });
            } else if (action === 'reorder') {
                clearCart();
                (order.items || []).forEach(item => addToCart(item, item.quantity || 1));
                navigate('/cart');
                return;
            } else if (action === 'edit') {
                clearCart();
                (order.items || []).forEach(item => addToCart(item, item.quantity || 1));
                await DB.deleteOrder(orderId);
                navigate('/cart');
                return;
            }
            await fetchAllData();
        } catch (e) {
            showConfirm('Fehler', e.message, null, false);
        }
    };

    const handleAction = (orderId, action) => {
        const msgs = {
            cancel:  { title: 'Stornieren',           message: 'Bestellung wirklich stornieren?',                    danger: true },
            delete:  { title: 'Entfernen',             message: 'Eintrag wirklich aus der Liste entfernen?',          danger: true },
            reorder: { title: 'Erneut bestellen',      message: 'Diese Bestellung in den Warenkorb legen?',           danger: false },
            edit:    { title: 'Bestellung bearbeiten', message: 'Der aktuelle Warenkorb wird überschrieben. Weiter?', danger: false },
        };
        const cfg = msgs[action];
        if (cfg) {
            showConfirm(cfg.title, cfg.message, () => doAction(orderId, action), cfg.danger);
        } else {
            doAction(orderId, action);
        }
    };

    const getStatusBadges = (order) => {
        const base = { padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' };
        const badges = [];

        switch (order.status) {
            case 'open':       badges.push(<span key="status" style={{ ...base, background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>Offen</span>); break;
            case 'processing': badges.push(<span key="status" style={{ ...base, background: 'rgba(234,179,8,0.12)', color: '#facc15' }}>In Bearbeitung</span>); break;
            case 'ordered':    badges.push(<span key="status" style={{ ...base, background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>Bestellt</span>); break;
            case 'completed':  badges.push(<span key="status" style={{ ...base, background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Bezahlt</span>); break;
            case 'cancelled':  badges.push(<span key="status" style={{ ...base, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Abgelehnt</span>); break;
            default:           badges.push(<span key="status" style={{ ...base, background: 'rgba(255,255,255,0.08)', color: 'var(--color-muted)' }}>{order.status}</span>); break;
        }

        if (order.status === 'ordered' && order.paymentStatus !== 'paid') {
            badges.push(<span key="payment" style={{ ...base, background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Nicht bezahlt</span>);
        }

        return <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start' }}>{badges}</div>;
    };

    const activeOrders  = myOrders.filter(o => !(o.archivedBy || []).includes(currentUser.username));
    const archivedOrders = myOrders.filter(o =>  (o.archivedBy || []).includes(currentUser.username));

    const getStorageItems = () => {
        const storageOrders = myOrders.filter(o => o.status === 'ordered' || o.status === 'completed');
        const itemsMap = {};

        storageOrders.forEach(order => {
            (order.items || []).forEach(item => {
                const remaining = (item.quantity || 0) - (item.delivered || 0);
                if (remaining > 0) {
                    if (!itemsMap[item.name]) itemsMap[item.name] = { count: 0, image: item.image };
                    itemsMap[item.name].count += remaining;
                }
            });
        });

        return Object.entries(itemsMap).map(([name, data]) => ({ name, count: data.count, image: data.image })).sort((a,b) => b.count - a.count);
    };

    const renderOrderCard = (order) => {
        const isArchived = (order.archivedBy || []).includes(currentUser.username);
        const total = Number(order.total || 0);

        return (
            <div key={order.id} className="glass-panel" style={{ padding: '1.25rem', opacity: isArchived ? 0.75 : 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>{order.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                            {new Date(order.date).toLocaleString('de-DE')}
                        </div>
                    </div>
                    {getStatusBadges(order)}
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
                    {(order.items || []).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span style={{ color: 'var(--color-muted)' }}>{item.quantity}x</span>
                            <span style={{ flex: 1, marginLeft: '0.5rem' }}>{item.name}</span>
                            <span style={{ color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                                {Number(item.price || item.originalPrice || 0).toFixed(2).replace('.', ',')} €
                            </span>
                        </div>
                    ))}
                </div>

                {/* Admin Note */}
                {order.adminNote && (
                    <div style={{ fontSize: '0.875rem', padding: '0.75rem', background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
                        <span style={{ color: '#facc15', fontWeight: '600', fontSize: '0.75rem' }}>Admin-Nachricht: </span>
                        {order.adminNote}
                    </div>
                )}

                {/* User Note */}
                {order.note && (
                    <div style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: '1rem', color: 'var(--color-muted)' }}>
                        Notiz: {order.note}
                    </div>
                )}

                {/* Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Gesamt</span>
                    <span style={{ fontWeight: '700', fontSize: '1.125rem' }}>{total.toFixed(2).replace('.', ',')} €</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {order.status === 'open' && !isArchived && (
                        <>
                            <button className="btn btn-secondary" onClick={() => handleAction(order.id, 'edit')}>
                                <Edit2 size={15} /> Bearbeiten
                            </button>
                            <button className="btn btn-danger" onClick={() => handleAction(order.id, 'cancel')}>
                                <Trash2 size={15} /> Stornieren
                            </button>
                        </>
                    )}
                    {(order.status === 'completed' || order.status === 'cancelled') && !isArchived && (
                        <button className="btn btn-secondary" onClick={() => doAction(order.id, 'archive')}>
                            <Archive size={15} /> Archivieren
                        </button>
                    )}
                    {order.status === 'cancelled' && !isArchived && (
                        <button className="btn btn-secondary" onClick={() => handleAction(order.id, 'reorder')}>
                            <ShoppingBag size={15} /> Erneut bestellen
                        </button>
                    )}
                    {isArchived && (
                        <>
                            <button className="btn btn-secondary" onClick={() => doAction(order.id, 'restore')}>
                                <RotateCcw size={15} /> Wiederherstellen
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleAction(order.id, 'reorder')}>
                                <ShoppingBag size={15} /> Erneut bestellen
                            </button>
                            <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => handleAction(order.id, 'delete')}>
                                <Trash2 size={15} /> Entfernen
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="container" style={{ paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Mein Profil</h1>
                <button className="btn btn-primary" onClick={() => setIsLagerModalOpen(true)}>
                    <Package size={18} /> Mein Lager
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeOrders.length === 0 && archivedOrders.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                        <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                        <p>Keine Bestellungen gefunden.</p>
                    </div>
                ) : (
                    <>
                        {activeOrders.map(renderOrderCard)}
                        {archivedOrders.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '0.75rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Archiv ({archivedOrders.length})
                                </h3>
                                {archivedOrders.map(renderOrderCard)}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Custom Confirm Modal */}
            <Modal
                isOpen={confirm.open}
                title={confirm.title}
                onClose={closeConfirm}
                onConfirm={confirm.onConfirm ? executeConfirm : undefined}
                confirmText="Bestätigen"
                isDanger={confirm.isDanger}
            >
                <p>{confirm.message}</p>
            </Modal>

            {/* Lager Modal */}
            <Modal
                isOpen={isLagerModalOpen}
                title={<span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={20} /> Mein Lager</span>}
                onClose={() => setIsLagerModalOpen(false)}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Hier siehst du alle bestellten Produkte, die noch nicht an dich ausgehändigt wurden.
                    </p>
                    
                    {getStorageItems().length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                            Dein Lager ist leer.
                        </div>
                    ) : (
                        getStorageItems().map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }} />
                                    )}
                                    <span style={{ fontWeight: '600' }}>{item.name}</span>
                                </div>
                                <span style={{ fontWeight: '700', color: 'var(--color-accent)' }}>{item.count}x</span>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    );
}

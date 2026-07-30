import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateVK, formatPrice } from '../services/pricing';
import { motion } from 'framer-motion';
import { DB } from '../services/db';
import Modal from '../components/Modal';

export default function UserExtras() {
    const { adminExtras, fetchAllData, currentUser, orders } = useAppContext();
    const navigate = useNavigate();

    // Confirm modal state
    const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, isDanger: false });

    const showConfirm = (title, message, onConfirm, isDanger = false) => {
        setConfirm({ open: true, title, message, onConfirm, isDanger });
    };

    const closeConfirm = () => setConfirm({ open: false, title: '', message: '', onConfirm: null, isDanger: false });

    const executeConfirm = async () => {
        if (confirm.onConfirm) await confirm.onConfirm();
        closeConfirm();
    };

    // Ensure data is fresh
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleRequestExtra = (product) => {
        showConfirm(
            "Produktanfrage",
            `Möchtest du 1x ${product.name} aus den Extras anfragen?`,
            async () => {
                try {
                    const reqOrder = {
                        id: 'REQ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                        user: currentUser.username,
                        status: 'request_open',
                        total: 0,
                        items: [{ name: product.name, quantity: 1, source: 'extra' }],
                        date: new Date().toISOString(),
                        paid: false,
                        adminNote: '',
                        note: 'Automatische Produktanfrage',
                        deletedByAdmin: false,
                        adminArchived: false,
                        archivedBy: []
                    };
                    await DB.saveOrder(reqOrder);
                    fetchAllData();
                } catch (err) {
                    console.error('Fehler beim Senden der Anfrage:', err);
                }
            }
        );
    };

    const handleWithdrawRequest = (reqId) => {
        showConfirm(
            "Anfrage zurückziehen",
            "Möchtest du diese Anfrage wirklich zurückziehen?",
            async () => {
                try {
                    await DB.deleteOrder(reqId);
                    fetchAllData();
                } catch (err) {
                    console.error('Fehler beim Zurückziehen:', err);
                }
            },
            true
        );
    };

    return (
        <div className="page-fade-in" style={{ padding: '3rem 1rem 80px 1rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                <button 
                    onClick={() => navigate('/home')} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.5rem' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Verfügbare Extras</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminExtras.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', gridColumn: '1 / -1' }}>
                        <p>Momentan sind keine Extras verfügbar.</p>
                    </div>
                ) : (
                    adminExtras.map((product) => {
                        // Extras kosten immer mindestens 5 EUR - die Pablo-Flatrate
                        // gilt hier bewusst nicht.
                        const displayPrice = calculateVK(product);
                        
                        const pendingRequestsCount = orders.filter(o => 
                            o.status === 'request_open' && 
                            o.items[0]?.source === 'extra' && 
                            o.items[0]?.name === product.name
                        ).reduce((sum, o) => sum + (o.items[0]?.quantity || 1), 0);
                        
                        const myPendingRequest = orders.find(o => 
                            o.status === 'request_open' && 
                            o.items[0]?.source === 'extra' && 
                            o.items[0]?.name === product.name &&
                            o.user === currentUser.username
                        );
                        
                        const availableQty = (product.quantity || 1) - pendingRequestsCount;
                        
                        return (
                            <motion.div 
                                key={product.id} 
                                className="glass-panel product-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ opacity: availableQty <= 0 && !myPendingRequest ? 0.7 : 1 }}
                            >
                                <div className="product-image-container">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="product-image" />
                                    ) : (
                                        <div className="product-image-placeholder">Kein Bild</div>
                                    )}
                                </div>
                                <div className="product-info">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <h3 className="product-name">{product.name}</h3>
                                    </div>
                                    {product.description && <p className="product-description">{product.description}</p>}
                                    
                                    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                                    {formatPrice(displayPrice)}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                                <span>Anzahl verfügbar: <strong style={{ color: 'var(--color-text)' }}>{availableQty}</strong></span>
                                                {myPendingRequest ? (
                                                    <button 
                                                        onClick={() => handleWithdrawRequest(myPendingRequest.id)}
                                                        className="btn" 
                                                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-success)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                                                    >
                                                        <CheckCircle size={14} /> Angefragt
                                                    </button>
                                                ) : availableQty > 0 ? (
                                                    <button 
                                                        onClick={() => handleRequestExtra(product)}
                                                        className="btn btn-secondary" 
                                                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                                                    >
                                                        <Send size={14} /> Anfragen
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: '600', padding: '0.25rem 0' }}>Bereits angefragt</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            <Modal
                isOpen={confirm.open}
                title={confirm.title}
                onClose={closeConfirm}
                onConfirm={confirm.onConfirm ? executeConfirm : null}
                confirmText={confirm.onConfirm ? "Bestätigen" : null}
                cancelText={confirm.onConfirm ? "Abbrechen" : "Schließen"}
                isDanger={confirm.isDanger}
            >
                <p>{confirm.message}</p>
            </Modal>
        </div>
    );
}

import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculatePrice, formatPrice } from '../services/pricing';
import { motion } from 'framer-motion';
import { DB } from '../services/db';

export default function UserExtras() {
    const { adminExtras, fetchAllData, currentUser, orders } = useAppContext();
    const navigate = useNavigate();

    // Ensure data is fresh
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleRequestExtra = async (product) => {
        if (!window.confirm(`Möchtest du 1x ${product.name} aus den Extras anfragen?`)) return;
        try {
            const reqOrder = {
                id: 'REQ-' + Date.now(),
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
            alert(`Anfrage für 1x ${product.name} wurde gesendet!`);
            fetchAllData();
        } catch (err) {
            alert('Fehler beim Senden der Anfrage: ' + err.message);
        }
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
                        const displayPrice = calculatePrice(product, currentUser);
                        
                        const pendingRequestsCount = orders.filter(o => 
                            o.status === 'request_open' && 
                            o.items[0]?.source === 'extra' && 
                            o.items[0]?.name === product.name
                        ).reduce((sum, o) => sum + (o.items[0]?.quantity || 1), 0);
                        
                        const availableQty = (product.quantity || 1) - pendingRequestsCount;
                        
                        return (
                            <motion.div 
                                key={product.id} 
                                className="glass-panel product-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ opacity: availableQty <= 0 ? 0.5 : 1 }}
                            >
                                <div className="product-image-container">
                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="product-image" style={{ filter: availableQty <= 0 ? 'grayscale(100%)' : 'none' }} />
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
                                                {availableQty > 0 ? (
                                                    <button 
                                                        onClick={() => handleRequestExtra(product)}
                                                        className="btn btn-secondary" 
                                                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                                                    >
                                                        <Send size={14} /> 1x Anfragen
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: '600', padding: '0.25rem 0' }}>Ausverkauft</span>
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
        </div>
    );
}

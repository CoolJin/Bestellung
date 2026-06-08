import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculatePrice, formatPrice } from '../services/pricing';
import { motion } from 'framer-motion';

export default function UserExtras() {
    const { adminExtras, fetchAllData } = useAppContext();
    const navigate = useNavigate();

    // Ensure data is fresh
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    return (
        <div className="page-fade-in" style={{ padding: '1rem', paddingBottom: '80px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                <button 
                    onClick={() => navigate('/home')} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.5rem' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Verfügbare Extras</h1>
            </div>

            <div className="catalog-grid">
                {adminExtras.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', gridColumn: '1 / -1' }}>
                        <p>Momentan sind keine Extras verfügbar.</p>
                    </div>
                ) : (
                    adminExtras.map((product) => {
                        const displayPrice = calculatePrice(product.price);
                        
                        return (
                            <motion.div 
                                key={product.id} 
                                className="product-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
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
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
                                                Anzahl verfügbar: <strong style={{ color: 'var(--color-text)' }}>{product.quantity || 1}</strong>
                                            </div>
                                        </div>
                                        
                                        <div className="btn btn-secondary w-full" style={{ opacity: 0.5, cursor: 'not-allowed', textAlign: 'center' }}>
                                            Nur Ansicht
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

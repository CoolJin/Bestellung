import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X, ShoppingCart, Check, Star } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { handleSearchLogic } from '../services/search';
import { useAppContext } from '../context/AppContext';
import { calculatePrice, calculateVK, formatPrice } from '../services/pricing';

// mode: 'cart' (default) | 'extras' (admin — adds to admin extras instead of cart)
export default function Catalog({ mode = 'cart' }) {
    const { addToCart, addToAdminExtras, currentUser } = useAppContext();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addedId, setAddedId] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            performSearch(q);
            // Optionally remove the query from URL after initial load
            setSearchParams({});
        }
    }, []);

    const performSearch = async (searchQuery) => {
        if (!searchQuery || searchQuery.length < 2) { setResults([]); return; }
        setLoading(true);
        setError('');
        try {
            const products = await handleSearchLogic(searchQuery);
            setResults(products);
        } catch (err) {
            setError(err.message || 'Fehler bei der Suche');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); performSearch(query); e.target.blur(); }
    };

    const clearSearch = () => { setQuery(''); setResults([]); setError(''); };

    const handleAdd = async (product) => {
        if (mode === 'extras') {
            await addToAdminExtras(product);
        } else {
            addToCart(product, 1);
        }
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1200);
    };

    return (
        <div className="container">
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-primary)', paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <SearchIcon size={20} style={{ position: 'absolute', left: '1rem', color: 'var(--color-muted)' }} />
                    <input
                        type="text"
                        className="form-input w-full"
                        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', height: '3rem', fontSize: '1rem', borderRadius: 'var(--radius-full)' }}
                        placeholder="Snuzone durchsuchen..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {query && (
                        <button onClick={clearSearch} style={{ position: 'absolute', right: '1rem', background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4">
                {loading && (
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                        <p className="text-muted">Suche nach "{query}"...</p>
                    </div>
                )}
                {error && (
                    <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}>
                        {error}
                    </div>
                )}
                {!loading && !error && results.length > 0 && (
                    <div className="grid grid-cols-2">
                        {results.map((product) => {
                            const displayPrice = mode === 'cart'
                                ? calculatePrice(product, currentUser)
                                : Number(product.originalPrice || product.price || 0);
                            const vkPrice = calculateVK(product);

                            return (
                                <div key={product.id} className="glass-panel product-card">
                                    <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                                    <div style={{ flex: 1 }}>
                                        <h3 className="product-title">{product.name}</h3>
                                        <p className="product-price" style={{ marginTop: '0.25rem' }}>
                                            {mode === 'extras' ? `EK: ${formatPrice(displayPrice)}` : formatPrice(displayPrice)}
                                        </p>
                                        {mode === 'extras' && (
                                            <p style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '0.125rem' }}>
                                                VK: {formatPrice(vkPrice)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        className={`btn w-full ${mode === 'extras' ? 'btn-secondary' : 'btn-primary'}`}
                                        onClick={() => handleAdd(product)}
                                        disabled={addedId === product.id}
                                    >
                                        {addedId === product.id
                                            ? <Check size={16} />
                                            : mode === 'extras'
                                                ? <><Star size={16} /> Zu Extras</>
                                                : <><ShoppingCart size={16} /> Hinzufügen</>
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {!loading && !error && results.length === 0 && query && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-muted)' }}>
                        <p>Drücke Enter um zu suchen.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

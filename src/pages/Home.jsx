import React, { useState } from 'react';
import { Search as SearchIcon, X, ShoppingCart, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { handleSearchLogic } from '../services/search';
import { calculatePrice, formatPrice } from '../services/pricing';

export default function Home() {
    const { addToCart, currentUser } = useAppContext();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addedId, setAddedId] = useState(null);

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

    const handleSearch = (e) => {
        e.preventDefault();
        performSearch(query.trim());
        
        // Remove focus from input to hide mobile keyboard
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }
    };

    const clearSearch = () => { setQuery(''); setResults([]); setError(''); };

    const handleAdd = (product) => {
        addToCart(product, 1);
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1200);
    };

    // Custom 1-second smooth scroll function
    const smoothScrollTo = (targetPosition, duration) => {
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        let startTime = null;

        const animation = (currentTime) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Ease-in-out cubic easing
            const ease = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
            window.scrollTo(0, startPosition + distance * ease);
            
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };
        
        requestAnimationFrame(animation);
    };

    // Mobile Keyboard UX Fixes
    const handleFocus = () => {
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                const wrapper = document.querySelector('.home-search-wrapper');
                if (wrapper) {
                    const absoluteBottom = wrapper.getBoundingClientRect().bottom + window.scrollY;
                    
                    // We use visualViewport to know exactly where the keyboard starts
                    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                    
                    // The exact space in pixels between the bottom of the search bar and the top of the keyboard.
                    // We set this very tight (15px) to effectively halve/minimize the gap as requested.
                    const desiredGap = 15; 
                    
                    const targetScrollY = absoluteBottom - viewportHeight + desiredGap;
                    
                    smoothScrollTo(Math.max(0, targetScrollY), 1000); // 1000ms = 1 second
                }
            }, 300);
        }
    };

    const handleBlur = () => {
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                smoothScrollTo(0, 1000); // 1000ms = 1 second
            }, 100);
        }
    };

    return (
        <div className={`home-container page-transition ${results.length > 0 ? 'has-results' : ''}`}>
            <div className="aurora-bg">
                <div className="aurora-blob aurora-1"></div>
                <div className="aurora-blob aurora-2"></div>
                <div className="aurora-blob aurora-3"></div>
            </div>
            
            <div className="home-content" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                {results.length === 0 && !loading && (
                    <div className="animate-fade-in-up">
                        <h1 className="home-title">Willkommen zurück</h1>
                        <p className="home-subtitle">Wonach suchst du heute?</p>
                    </div>
                )}
                
                <form onSubmit={handleSearch} className="home-search-wrapper" style={{ marginBottom: '2rem' }}>
                    <div className="home-search-container">
                        <SearchIcon size={26} className="search-icon" style={{ color: 'rgba(255,255,255,0.7)' }} />
                        <input
                            type="text"
                            placeholder="Produkte suchen..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="home-search-input"
                        />
                        {query && (
                            <button type="button" onClick={clearSearch} style={{ position: 'absolute', right: '1.5rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', zIndex: 10 }}>
                                <X size={24} />
                            </button>
                        )}
                    </div>
                </form>

                <div className="w-full">
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                            <p className="text-muted">Suche nach "{query}"...</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', textAlign: 'center', borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}>
                            {error}
                        </div>
                    )}
                    
                    {!loading && !error && results.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ paddingBottom: '6rem' }}>
                            {results.map((product) => {
                                const displayPrice = calculatePrice(product, currentUser);

                                return (
                                    <div key={product.id} className="glass-panel product-card">
                                        <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                                        <div style={{ flex: 1, padding: '0.5rem 0' }}>
                                            <h3 className="product-title">{product.name}</h3>
                                            <p className="product-price" style={{ marginTop: '0.25rem' }}>
                                                {formatPrice(displayPrice)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn w-full btn-primary"
                                            onClick={() => handleAdd(product)}
                                            disabled={addedId === product.id}
                                        >
                                            {addedId === product.id
                                                ? <Check size={16} />
                                                : <><ShoppingCart size={16} /> Hinzufügen</>
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {!loading && !error && results.length === 0 && query && (
                        <div className="animate-fade-in-up" style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-muted)' }}>
                            <p>Drücke Enter um zu suchen.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef, useEffect } from 'react';
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
    const [animPhase, setAnimPhase] = useState('idle'); // idle | keyboard_hiding | fading_out | scrolling | done

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

    const triggerSearch = () => {
        if (animPhase === 'fading_out' || animPhase === 'scrolling') return; // Prevent double trigger

        const input = document.querySelector('.home-search-input');
        if (input) input.blur();

        performSearch(query.trim());

        if (window.innerWidth <= 768) {
            if (animPhase === 'done') {
                setAnimPhase('keyboard_hiding');
                setTimeout(() => {
                    setAnimPhase('scrolling');
                    smoothScrollTo(0, 1000);
                    setTimeout(() => setAnimPhase('done'), 1000);
                }, 300);
            } else {
                setAnimPhase('keyboard_hiding');
                setTimeout(() => {
                    setAnimPhase('fading_out');
                    setTimeout(() => {
                        setAnimPhase('scrolling');
                        smoothScrollTo(0, 1000);
                        setTimeout(() => setAnimPhase('done'), 1000);
                    }, 400); // 400ms CSS fade duration
                }, 300); // 300ms keyboard hide duration
            }
        } else {
            setAnimPhase('done');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (e.key === 'Enter' || e.type === 'submit') {
            triggerSearch();
        }
    };

    const clearSearch = () => { setQuery(''); setResults([]); setError(''); };

    const handleAdd = (product) => {
        addToCart(product, 1);
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1200);
    };

    const animationFrameRef = useRef(null);

    // Custom 1-second smooth scroll function
    const smoothScrollTo = (targetPosition, duration) => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

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
                animationFrameRef.current = requestAnimationFrame(animation);
            } else {
                animationFrameRef.current = null;
            }
        };
        
        animationFrameRef.current = requestAnimationFrame(animation);
    };

    // Mobile Keyboard UX Fixes
    const handleFocus = () => {
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                const hintText = document.querySelector('.enter-to-search-text');
                const wrapper = document.querySelector('.home-search-wrapper');
                
                if (hintText && window.visualViewport) {
                    const absoluteBottom = hintText.getBoundingClientRect().bottom + window.scrollY;
                    const viewportHeight = window.visualViewport.height;
                    const targetScrollY = absoluteBottom - viewportHeight + 10; 
                    smoothScrollTo(Math.max(0, targetScrollY), 1000);
                } else if (wrapper && window.visualViewport) {
                    const absoluteBottom = wrapper.getBoundingClientRect().bottom + window.scrollY;
                    const viewportHeight = window.visualViewport.height;
                    const targetScrollY = absoluteBottom - viewportHeight + 40;
                    smoothScrollTo(Math.max(0, targetScrollY), 1000);
                }
            }, 300);
        }
    };

    const handleBlur = () => {
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                if (results.length === 0 && !loading) {
                    smoothScrollTo(0, 1000);
                }
            }, 100);
        }
    };

    const isHintVisible = !!(query && results.length === 0 && !loading && !error);

    useEffect(() => {
        if (window.innerWidth > 768) return;
        if (!window.visualViewport) return;

        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const isFocused = document.activeElement === document.querySelector('.home-search-input');
                if (!isFocused) return;

                const viewportHeight = window.visualViewport.height;
                const innerHeight = window.innerHeight;

                // If viewport is close to innerHeight, the keyboard was hidden manually by the user
                if (viewportHeight > innerHeight * 0.85) {
                    smoothScrollTo(0, 1000);
                    document.activeElement.blur(); // Remove focus since keyboard is gone
                }
            }, 150);
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => {
            clearTimeout(resizeTimeout);
            window.visualViewport.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (window.innerWidth > 768) return;
        
        // Ensure input is focused so we only adjust if keyboard is open
        const isFocused = document.activeElement === document.querySelector('.home-search-input');
        if (!isFocused) return;

        setTimeout(() => {
            if (isHintVisible) {
                const hintText = document.querySelector('.enter-to-search-text');
                if (hintText && window.visualViewport) {
                    const absoluteBottom = hintText.getBoundingClientRect().bottom + window.scrollY;
                    const viewportHeight = window.visualViewport.height;
                    const targetScrollY = absoluteBottom - viewportHeight + 10; // 10px gap for hint text
                    smoothScrollTo(Math.max(0, targetScrollY), 1000);
                }
            } else if (!query && results.length === 0) {
                const wrapper = document.querySelector('.home-search-wrapper');
                if (wrapper && window.visualViewport) {
                    const absoluteBottom = wrapper.getBoundingClientRect().bottom + window.scrollY;
                    const viewportHeight = window.visualViewport.height;
                    const targetScrollY = absoluteBottom - viewportHeight + 40; // Revert to 40px gap for search bar
                    smoothScrollTo(Math.max(0, targetScrollY), 1000);
                }
            }
        }, 50); // Short delay to let React render the DOM change
    }, [isHintVisible]);

    useEffect(() => {
        if (!query && animPhase !== 'idle') {
            setAnimPhase('idle');
            setResults([]);
        }
    }, [query, animPhase]);

    const isFadingOrDone = animPhase !== 'idle' && animPhase !== 'keyboard_hiding';
    const isSearchingLayout = animPhase === 'scrolling' || animPhase === 'done';
    
    const titlesClass = animPhase === 'idle' || animPhase === 'keyboard_hiding' 
        ? '' 
        : animPhase === 'fading_out' 
            ? 'fading-out' 
            : 'scrolling-up';

    return (
        <div className={`home-container page-transition ${isSearchingLayout ? 'is-searching' : ''}`}>
            <div className="aurora-bg">
                <div className="aurora-blob aurora-1"></div>
                <div className="aurora-blob aurora-2"></div>
                <div className="aurora-blob aurora-3"></div>
            </div>
            
            <div className="home-content" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                <div className={`home-titles-wrapper ${titlesClass}`}>
                    <div className="animate-fade-in-up">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00eecc', boxShadow: '0 0 10px #00eecc' }}></div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.8)' }}>SYSTEM BEREIT</span>
                        </div>
                        <h1 className="home-title">Willkommen zurück</h1>
                        <p className="home-subtitle">Wonach suchst du heute?</p>
                    </div>
                </div>
                
                <form onSubmit={handleSearch} className="home-search-wrapper" style={{ marginBottom: '2rem' }}>
                    <div className="home-search-container">
                        <SearchIcon 
                            className="home-search-icon" 
                            size={24} 
                            style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} 
                            onClick={triggerSearch}
                        />
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

                    {query && results.length === 0 && (animPhase === 'idle' || animPhase === 'keyboard_hiding' || animPhase === 'fading_out') && (
                        <div className="animate-fade-in-up enter-to-search-text" style={{ textAlign: 'center', paddingTop: '2rem', color: 'var(--color-muted)', transition: 'opacity 0.4s ease', opacity: isFadingOrDone ? 0 : 1 }}>
                            <p>Drücke Enter um zu suchen.</p>
                        </div>
                    )}
                </form>

                {animPhase === 'done' && (
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
                    </div>
                )}
            </div>
        </div>
    );
}

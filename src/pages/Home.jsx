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
    const [searchPhase, setSearchPhase] = useState('idle'); // 'idle', 'fading_text', 'moving_bar', 'waiting_for_results', 'results'
    const [isFadingOutGrid, setIsFadingOutGrid] = useState(false);
    const titleWrapperRef = useRef(null);
    const hintWrapperRef = useRef(null);

    useEffect(() => {
        if (searchPhase === 'fading_text') {
            if (titleWrapperRef.current) titleWrapperRef.current.style.height = `${titleWrapperRef.current.offsetHeight}px`;
            if (hintWrapperRef.current) hintWrapperRef.current.style.height = `${hintWrapperRef.current.offsetHeight}px`;
        } else if (searchPhase === 'moving_bar') {
            if (titleWrapperRef.current) {
                void titleWrapperRef.current.offsetHeight;
                titleWrapperRef.current.style.height = '0px';
            }
            if (hintWrapperRef.current) {
                void hintWrapperRef.current.offsetHeight;
                hintWrapperRef.current.style.height = '0px';
            }
        }
    }, [searchPhase]);

    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    const triggerSearch = async () => {
        if (!query || query.length < 2) { 
            setResults([]); 
            setSearchPhase('idle');
            return; 
        }

        const input = document.querySelector('.home-search-input');
        if (input) input.blur();

        if (searchPhase === 'results' || searchPhase === 'waiting_for_results') {
            if (searchPhase === 'results') {
                setIsFadingOutGrid(true);
                await wait(500);
            }
            setSearchPhase('waiting_for_results');
            setIsFadingOutGrid(false);
            setLoading(true);
            setError('');
            
            // Close keyboard if open when hitting enter again
            const input = document.querySelector('.home-search-input');
            if (input) input.blur();
            
            try {
                const products = await handleSearchLogic(query.trim());
                setResults(products);
                setSearchPhase('results');
            } catch(err) {
                setError(err.message || 'Fehler bei der Suche');
                setResults([]);
            } finally {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        setError('');
        
        let scrollYBeforeBlur = 0;
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Lock body to prevent native mobile browser scroll-bounce when keyboard closes
            scrollYBeforeBlur = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollYBeforeBlur}px`;
            document.body.style.width = '100%';
        }

        if (input) input.blur();
        setSearchPhase('fading_text');

        try {
            const fetchPromise = handleSearchLogic(query.trim());

            const animationPromise = (async () => {
                await wait(500); // Wait for texts to fade out
                
                if (isMobile) {
                    // Unlock body and restore scroll instantly before starting our smooth scroll
                    document.body.style.position = '';
                    document.body.style.top = '';
                    document.body.style.width = '';
                    window.scrollTo(0, scrollYBeforeBlur);
                }

                setSearchPhase('moving_bar');
                
                // We scroll to exactly 0 (top of the page) as requested.
                // The CSS .search-active class will simultaneously transition the padding to 40px.
                smoothScrollTo(0, 1000);
                
                await wait(1000); // Wait for smooth scroll to finish
                setSearchPhase('waiting_for_results');
            })();

            const [products] = await Promise.all([fetchPromise, animationPromise]);
            
            setSearchPhase('results');
            setResults(products);
        } catch (err) {
            setError(err.message || 'Fehler bei der Suche');
            setResults([]);
            setSearchPhase('idle');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (e.key === 'Enter' || e.type === 'submit') {
            triggerSearch();
        }
    };

    const clearSearch = async () => { 
        if (searchPhase === 'results' || searchPhase === 'waiting_for_results') {
            setIsFadingOutGrid(true);
            await wait(500); // Wait 500ms for fade out as requested
        }
        setQuery(''); 
        setResults([]); 
        setError(''); 
        setIsFadingOutGrid(false);
        // We no longer set searchPhase to 'idle' so the search bar stays at the top!
        
        const input = document.querySelector('.home-search-input');
        if (input) input.focus();
    };

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
                if (searchPhase === 'idle') {
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
                if (viewportHeight > innerHeight * 0.85 && searchPhase === 'idle') {
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

    return (
        <div className={`home-container page-transition ${searchPhase !== 'idle' && searchPhase !== 'fading_text' ? 'search-active' : ''}`}>
            <div className="aurora-bg">
                <div className="aurora-blob aurora-1"></div>
                <div className="aurora-blob aurora-2"></div>
                <div className="aurora-blob aurora-3"></div>
            </div>
            
            <div className="home-content" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                {(searchPhase === 'idle' || searchPhase === 'fading_text' || searchPhase === 'moving_bar') && (
                    <div ref={titleWrapperRef} className={`hero-texts-wrapper`}>
                        <div className={`hero-texts animate-fade-in-up ${searchPhase !== 'idle' ? 'fade-out' : ''}`}>
                            <h1 className="home-title">Willkommen zurück</h1>
                            <p className="home-subtitle">Wonach suchst du heute?</p>
                        </div>
                    </div>
                )}
                
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
                </form>

                <div className="w-full">
                    {searchPhase === 'waiting_for_results' && (
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
                    
                    {(searchPhase === 'idle' || searchPhase === 'fading_text' || searchPhase === 'moving_bar') && query && results.length === 0 && (
                        <div ref={hintWrapperRef} className={`hero-texts-wrapper`}>
                            <div className={`hero-texts animate-fade-in-up enter-to-search-text ${searchPhase !== 'idle' ? 'fade-out' : ''}`} style={{ textAlign: 'center', paddingTop: '2rem', color: 'var(--color-muted)' }}>
                                <p>Drücke Enter um zu suchen.</p>
                            </div>
                        </div>
                    )}
                    
                    {searchPhase === 'results' && !error && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in-up" 
                             style={{ 
                                 paddingBottom: '6rem',
                                 transition: 'opacity 0.5s ease',
                                 opacity: isFadingOutGrid ? 0 : 1,
                                 pointerEvents: isFadingOutGrid ? 'none' : 'auto'
                             }}>
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
            </div>
        </div>
    );
}

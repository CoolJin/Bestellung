import React, { useState, useRef, useEffect } from 'react';
import { Search as SearchIcon, X, ShoppingCart, Check } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { handleSearchLogic } from '../services/search';
import { calculatePrice, formatPrice } from '../services/pricing';
import GlassSurface from '../components/GlassSurface';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Home() {
    const { addToCart, currentUser, adminExtras = [] } = useAppContext();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addedId, setAddedId] = useState(null);
    const [searchPhase, setSearchPhase] = useState('idle'); // 'idle', 'fading_text', 'moving_bar', 'waiting_for_results', 'results'
    const [isFadingOutGrid, setIsFadingOutGrid] = useState(false);
    const [showExtrasBanner, setShowExtrasBanner] = useState(false);
    const titleWrapperRef = useRef(null);
    const hintWrapperRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowExtrasBanner(true);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

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
        setQuery(''); // Clear text and X button instantly
        
        if (searchPhase === 'results' || searchPhase === 'waiting_for_results') {
            setIsFadingOutGrid(true);
            await wait(500); // Wait 500ms for fade out as requested
        }
        
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
                const wrapper = document.querySelector('.home-search-wrapper');
                
                if (wrapper && window.visualViewport) {
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

    // Scroll after banner expands
    useEffect(() => {
        if (showExtrasBanner && window.innerWidth <= 768) {
            const isFocused = document.activeElement === document.querySelector('.home-search-input');
            if (isFocused) {
                setTimeout(() => {
                    const wrapper = document.querySelector('.home-search-wrapper');
                    if (wrapper && window.visualViewport) {
                        const absoluteBottom = wrapper.getBoundingClientRect().bottom + window.scrollY;
                        const viewportHeight = window.visualViewport.height;
                        const targetScrollY = absoluteBottom - viewportHeight + 40;
                        smoothScrollTo(Math.max(0, targetScrollY), 1000);
                    }
                }, 1050);
            }
        }
    }, [showExtrasBanner]);

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
                
                <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                    <GlassSurface 
                        className="home-search-wrapper" 
                        width="100%" 
                        height="auto" 
                        borderRadius={100} 
                        borderWidth={0.15}
                        backgroundOpacity={0.15}
                        brightness={60}
                        saturation={1}
                        opacity={1}
                        blur={15}
                        displace={1}
                        distortionScale={-180}
                        redOffset={30}
                        greenOffset={40}
                        blueOffset={50}
                        style={{ 
                            maxWidth: '600px'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div className="home-search-container" style={{ width: '100%' }}>
                                <SearchIcon 
                                    className="home-search-icon" 
                                    size={24} 
                                    style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer', flexShrink: 0 }} 
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
                                <button 
                                    type="button" 
                                    onClick={clearSearch} 
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: 'rgba(255,255,255,0.5)', 
                                        cursor: query ? 'pointer' : 'default', 
                                        zIndex: 10, 
                                        flexShrink: 0, 
                                        padding: 0,
                                        opacity: query ? 1 : 0,
                                        pointerEvents: query ? 'auto' : 'none',
                                        transition: 'opacity 0.2s ease'
                                    }}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <AnimatePresence>
                                {showExtrasBanner && searchPhase === 'idle' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 1 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ padding: '1rem 2rem 1.25rem 2rem', display: 'flex', justifyContent: 'center' }}>
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigate('/extras'); }} 
                                                className="btn btn-frosted-gold w-full"
                                            >
                                                <svg 
                                                    className="btn-laser-svg" 
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <rect 
                                                        x="0" y="0" 
                                                        width="100%" height="100%" 
                                                        rx="25" ry="25" 
                                                        pathLength="100"
                                                    />
                                                </svg>
                                                <span>Verfügbare Extras</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </GlassSurface>
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
                    

                    {searchPhase === 'results' && !error && (
                        <div className={`grid grid-cols-2 gap-4 ${isFadingOutGrid ? 'animate-fade-out' : 'animate-fade-in-up'}`} 
                             style={{ 
                                 paddingBottom: '6rem',
                                 pointerEvents: isFadingOutGrid ? 'none' : 'auto'
                             }}>
                            {results.map((product) => {
                                const displayPrice = calculatePrice(product, currentUser);
                                const extraItem = adminExtras.find(e => 
                                    e.id === product.id || 
                                    (e.name && product.name && e.name.trim().toLowerCase() === product.name.trim().toLowerCase())
                                );

                                return (
                                    <div key={product.id} className="glass-panel product-card" style={{ position: 'relative' }}>
                                        {extraItem && (
                                            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--color-accent)', color: 'var(--color-accent-fg)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', zIndex: 10, boxShadow: 'var(--shadow-sm)' }}>
                                                {extraItem.quantity || 1}x verfügbar in Extras
                                            </div>
                                        )}
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

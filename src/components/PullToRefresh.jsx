import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const TRIGGER_DISTANCE = 70;   // ab hier wird ausgelöst
const MAX_PULL = 110;          // weiter lässt sich nicht ziehen

/**
 * Ziehen zum Aktualisieren für Touchgeräte.
 * Greift nur, wenn die Seite ganz oben steht und nach unten gezogen wird -
 * normales Scrollen bleibt unberührt.
 */
export default function PullToRefresh({ onRefresh, children }) {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startY = useRef(null);
    const active = useRef(false);

    useEffect(() => {
        // Nur auf Touchgeräten - am Desktop gibt es F5.
        if (!window.matchMedia('(hover: none)').matches) return;

        const onTouchStart = (e) => {
            if (refreshing || e.touches.length !== 1) return;
            if (window.scrollY > 0) return;
            startY.current = e.touches[0].clientY;
            active.current = false;
        };

        const onTouchMove = (e) => {
            if (startY.current === null || refreshing) return;

            const delta = e.touches[0].clientY - startY.current;

            // Nach oben gewischt oder nicht mehr ganz oben: abbrechen
            if (delta <= 0 || window.scrollY > 0) {
                if (active.current) { active.current = false; setPull(0); }
                startY.current = null;
                return;
            }

            // Erst ab etwas Widerstand übernehmen, damit ein Tippen nicht stört
            if (!active.current && delta < 8) return;
            active.current = true;

            if (e.cancelable) e.preventDefault();
            // Gummiband-Gefühl: je weiter gezogen, desto zäher
            setPull(Math.min(MAX_PULL, delta * 0.5));
        };

        const onTouchEnd = async () => {
            if (!active.current) { startY.current = null; return; }
            active.current = false;
            startY.current = null;

            if (pull >= TRIGGER_DISTANCE) {
                setRefreshing(true);
                setPull(TRIGGER_DISTANCE);
                try {
                    await onRefresh();
                } catch (err) {
                    console.error('Aktualisieren fehlgeschlagen', err);
                } finally {
                    setRefreshing(false);
                    setPull(0);
                }
            } else {
                setPull(0);
            }
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [pull, refreshing, onRefresh]);

    const visible = pull > 0 || refreshing;
    const progress = Math.min(1, pull / TRIGGER_DISTANCE);

    return (
        <>
            {visible && (
                <div
                    className="ptr-indicator"
                    style={{
                        height: `${pull}px`,
                        opacity: progress,
                        transition: pull === 0 ? 'height 0.25s ease, opacity 0.25s ease' : 'none',
                    }}
                >
                    <div className="ptr-circle">
                        <RefreshCw
                            size={16}
                            style={{
                                transform: `rotate(${progress * 270}deg)`,
                                animation: refreshing ? 'ptr-spin 0.8s linear infinite' : 'none',
                            }}
                        />
                    </div>
                </div>
            )}
            <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
            {children}
        </>
    );
}

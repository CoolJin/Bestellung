import { useEffect, useState } from 'react';
import { X, Share, Plus, Smartphone } from 'lucide-react';

const DISMISSED_KEY = 'sns-install-dismissed';
const VISITS_KEY = 'sns-visits';
const MIN_VISITS = 3;

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

// Besuche werden pro Seitenaufruf nur einmal gezählt, auch wenn React die
// Komponente doppelt initialisiert (StrictMode).
let visitCounted = false;

const countVisit = () => {
    if (visitCounted) return Number(localStorage.getItem(VISITS_KEY) || 0);
    visitCounted = true;
    const visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1;
    try { localStorage.setItem(VISITS_KEY, String(visits)); } catch { /* Speicher voll */ }
    return visits;
};

/** iOS kennt beforeinstallprompt nicht - dort wird direkt die Anleitung gezeigt. */
const shouldShowIOSHint = () => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return false;
    return countVisit() >= MIN_VISITS && isIOS();
};

/**
 * Weist dezent darauf hin, dass sich die Seite als App auf den
 * Startbildschirm legen lässt - erst ab dem dritten Besuch, damit es
 * beim Ausprobieren nicht stört.
 */
export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow] = useState(shouldShowIOSHint);

    useEffect(() => {
        if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

        const onPrompt = (e) => {
            e.preventDefault();
            if (countVisit() < MIN_VISITS) return;
            setDeferredPrompt(e);
            setShow(true);
        };

        window.addEventListener('beforeinstallprompt', onPrompt);
        return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Speicher voll */ }
        setShow(false);
    };

    const install = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        dismiss();
    };

    if (!show) return null;

    return (
        <div className="install-banner">
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.5rem', borderRadius: '50%', flexShrink: 0 }}>
                <Smartphone size={18} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Als App installieren</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.15rem', lineHeight: 1.35 }}>
                    {deferredPrompt ? (
                        'Startet im Vollbild, ohne Browserleiste.'
                    ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                            Teilen <Share size={12} /> → „Zum Home-Bildschirm" <Plus size={12} />
                        </span>
                    )}
                </div>
            </div>

            {deferredPrompt && (
                <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={install}>
                    Installieren
                </button>
            )}

            <button
                onClick={dismiss}
                className="tap-target"
                aria-label="Hinweis schließen"
                style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}
            >
                <X size={18} />
            </button>
        </div>
    );
}

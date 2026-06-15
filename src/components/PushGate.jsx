import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Share, PlusSquare, ArrowUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function PushGate({ children }) {
    const { currentUser } = useAppContext();
    const [status, setStatus] = useState('checking');
    const [isMobile, setIsMobile] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Detect if Mobile
        const ua = navigator.userAgent;
        const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
        setIsMobile(mobile);

        // Detect if iOS
        const ios = /iPhone|iPad|iPod/i.test(ua);
        setIsIOS(ios);

        // Detect if PWA Standalone (added to home screen)
        const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(standalone);

        // Check Push Permission
        if (!('Notification' in window)) {
            // Browser doesn't support notifications
            setStatus('granted'); 
            return;
        }

        setStatus(Notification.permission);
    }, []);

    const requestPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setStatus(permission);
        } catch (error) {
            console.error('Error requesting push permission:', error);
        }
    };

    // If no user is logged in, don't gate (login page is free)
    if (!currentUser) return children;

    // Desktop users bypass the gate entirely
    if (!isMobile) return children;

    // If permission is already granted, let them in
    if (status === 'granted') return children;

    // If permission is explicitly denied, show instructions to fix it
    if (status === 'denied') {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
                <BellOff size={64} style={{ color: 'var(--color-destructive)', marginBottom: '1.5rem' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>Benachrichtigungen blockiert</h1>
                <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    Du hast die Push-Benachrichtigungen für das Bestellsystem abgelehnt. Um die Seite nutzen zu können, musst du diese Berechtigung in den Einstellungen deines Handys (oder Browsers) wieder zulassen.
                </p>
                <div className="glass-panel" style={{ padding: '1.5rem', width: '100%' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>So behebst du das Problem:</p>
                    <ol style={{ fontSize: '0.875rem', color: 'var(--color-muted)', textAlign: 'left', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                        <li>Gehe in die Einstellungen deines Handys.</li>
                        <li>Suche nach den Browser-Einstellungen (z.B. Safari oder Chrome).</li>
                        <li>Setze die Berechtigung für Mitteilungen/Benachrichtigungen auf "Erlauben".</li>
                        <li>Lade diese Seite neu.</li>
                    </ol>
                </div>
            </div>
        );
    }

    // Default state: Ask for permission
    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
            <Bell size={64} style={{ color: 'var(--color-accent)', marginBottom: '1.5rem' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>Bleib immer informiert!</h1>
            <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                Um keine wichtigen Updates zu deiner Bestellung zu verpassen, musst du die Push-Benachrichtigungen aktivieren. Das System kann erst danach genutzt werden.
            </p>

            {isIOS && !isStandalone ? (
                <div className="glass-panel" style={{ padding: '1.5rem', width: '100%', position: 'relative' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Installation erforderlich</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginBottom: '1.5rem', textAlign: 'left' }}>
                        Da du ein iPhone nutzt, musst du die Seite erst als App auf deinem Startbildschirm ablegen, um Benachrichtigungen empfangen zu können:
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', textAlign: 'left' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                            <Share size={24} />
                        </div>
                        <span style={{ fontSize: '0.875rem' }}>1. Tippe unten im Safari-Menü auf den <strong>Teilen-Button</strong>.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                            <PlusSquare size={24} />
                        </div>
                        <span style={{ fontSize: '0.875rem' }}>2. Wähle <strong>"Zum Home-Bildschirm"</strong>.</span>
                    </div>
                    <div style={{ marginTop: '2rem', color: 'var(--color-accent)', animation: 'bounce 2s infinite' }}>
                        <ArrowUp size={32} />
                    </div>
                    <style>
                        {`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }`}
                    </style>
                </div>
            ) : (
                <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={requestPermission}>
                    Benachrichtigungen aktivieren
                </button>
            )}
        </div>
    );
}

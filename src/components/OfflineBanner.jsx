import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Zeigt einen Hinweis, sobald das Gerät offline ist. Ohne diesen schlagen
 * Anfragen still fehl und man sieht unbemerkt veraltete Daten.
 */
export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);

        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="offline-banner" role="status">
            <WifiOff size={15} />
            Keine Verbindung – Änderungen werden nicht gespeichert
        </div>
    );
}

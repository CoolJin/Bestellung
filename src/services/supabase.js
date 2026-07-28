import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
        'Supabase ist nicht konfiguriert. Lege lokal eine .env nach dem Vorbild ' +
        'von .env.example an bzw. hinterlege für das Deployment die Repository-' +
        'Secrets VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY.'
    );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storageKey: 'sns-auth',
        persistSession: true,
        autoRefreshToken: true,
    },
});

/**
 * Zweiter Client ohne eigene Session-Speicherung.
 * Wird gebraucht, wenn ein Admin einen Benutzer anlegt: signUp() würde sonst
 * die Session des Admins durch die des neuen Benutzers ersetzen.
 */
export const createIsolatedClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});

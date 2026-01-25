
// --- js/supabase-client.js ---
// Credentials provided by user
const SUPABASE_URL = 'https://tljtedqzmjvxcvadspgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_36g6-riddPqND8OR16hp7w_iuZadD4j';

let client = null;

if (window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase Client: Initialized');
} else {
    console.error('Supabase SDK not loaded! Check internet connection or adblocker.');
}

export const supabaseClient = client;


// --- js/supabase-client.js ---
// Credentials provided by user
const SUPABASE_URL = 'https://tljtedqzmjvxcvadspgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_36g6-riddPqND8OR16hp7w_iuZadD4j'; // Using the provided key

// Initialize client
// The script tag in index.html exposes 'supabase' globally as 'supabase.createClient'
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

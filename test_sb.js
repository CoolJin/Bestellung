import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tljtedqzmjvxcvadspgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_36g6-riddPqND8OR16hp7w_iuZadD4j';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabaseClient.from('users').select('*');
        console.log("Error:", error);
        console.log("Data:", data ? data.length : null);
    } catch (e) {
        console.error("Exception:", e);
    }
}
test();

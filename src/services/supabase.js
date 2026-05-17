import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tljtedqzmjvxcvadspgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_36g6-riddPqND8OR16hp7w_iuZadD4j';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

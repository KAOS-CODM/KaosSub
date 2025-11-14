const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('SUPABASE_URL:', supabaseUrl ? '***' : 'MISSING');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '***' : 'MISSING');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

console.log('✅ Supabase client initialized with service role key');
module.exports = supabase;

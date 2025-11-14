const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Make sure this uses SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration in environment variables');
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

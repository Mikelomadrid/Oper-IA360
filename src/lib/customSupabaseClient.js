import { createClient } from '@supabase/supabase-js';

const supabaseUrl = window.SUPABASE_CONFIG?.url || 'https://dkkiomutzyvscnqqchqs.supabase.co';
const supabaseAnonKey = window.SUPABASE_CONFIG?.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRra2lvbXV0enl2c2NucXFjaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTkxNjQsImV4cCI6MjA3NjAzNTE2NH0.oZCxYbVoRYFhU7RCm1XR4cRsQ92E1tj78HtqFRuag6g';

if (window.SUPABASE_CONFIG) {
    console.log("Supabase initialized with dynamic config from config.js");
} else {
    console.warn("SUPABASE_CONFIG not found, using compiled fallbacks");
}

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
};

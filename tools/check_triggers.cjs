const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dkkiomutzyvscnqqchqs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRra2lvbXV0enl2c2NucXFjaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTkxNjQsImV4cCI6MjA3NjAzNTE2NH0.oZCxYbVoRYFhU7RCm1XR4cRsQ92E1tj78HtqFRuag6g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log("Checking for triggers on leads table...");
    const { data: triggers, error: tError } = await supabase.rpc('run_sql', {
        sql: `
            SELECT tgname as trigger_name, proname as function_name, prosrc as function_body
            FROM pg_trigger
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
            JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
            WHERE pg_class.relname = 'leads';
        `
    });
    if (tError) {
        console.error('Trigger Error:', tError);
    } else {
        console.log("TRIGGERS ON LEADS:");
        console.log(JSON.stringify(triggers, null, 2));
    }

    console.log("\nChecking for functions containing 'CONVERTIDO A' or project insertion logs...");
    const { data: funcs, error: fError } = await supabase.rpc('run_sql', {
        sql: `
            SELECT proname as function_name, prosrc as function_body
            FROM pg_proc 
            WHERE prosrc ILIKE '%CONVERTIDO%' OR prosrc ILIKE '%insert into proyectos%';
        `
    });
    if (fError) {
        console.error('Func Error:', fError);
    } else {
        console.log("SUSPICIOUS FUNCTIONS:");
        console.log(JSON.stringify(funcs, null, 2));
    }
}

check();

import { createClient } from '@supabase/supabase-js';

const PRODUCTION_PROJECT_REF = 'dkkiomutzyvscnqqchqs';
const isDevelopment = import.meta.env.DEV;

const developmentConfig = {
    url: import.meta.env.VITE_SUPABASE_URL,
    key:
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const runtimeConfig = window.SUPABASE_CONFIG || {};
const supabaseUrl = isDevelopment
    ? developmentConfig.url
    : runtimeConfig.url || developmentConfig.url;
const supabaseAnonKey = isDevelopment
    ? developmentConfig.key
    : runtimeConfig.anonKey || developmentConfig.key;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Falta la configuración de Supabase para este entorno. Se bloquea el arranque para evitar conexiones accidentales.'
    );
}

let activeProjectRef;
try {
    activeProjectRef = runtimeConfig.projectRef || new URL(supabaseUrl).hostname.split('.')[0];
} catch {
    throw new Error('La URL configurada para Supabase no es válida.');
}

const expectedProjectRef = import.meta.env.VITE_EXPECTED_SUPABASE_REF;

if (isDevelopment && activeProjectRef === PRODUCTION_PROJECT_REF) {
    throw new Error(
        'BLOQUEO DE SEGURIDAD: el ERP local no puede conectarse al proyecto de producción.'
    );
}

if (isDevelopment && expectedProjectRef && activeProjectRef !== expectedProjectRef) {
    throw new Error(
        `BLOQUEO DE SEGURIDAD: se esperaba el proyecto ${expectedProjectRef}, pero se configuró ${activeProjectRef}.`
    );
}

console.info(
    `Supabase inicializado en modo ${isDevelopment ? 'desarrollo' : 'producción'} con el proyecto ${activeProjectRef}.`
);

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: activeProjectRef
        ? { storageKey: `sb-${activeProjectRef}-auth-token` }
        : undefined,
});

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
};

// backfill-thumbnails.mjs
//
// Genera miniaturas WebP para las fotos de obra que ya existen en Storage
// y no tienen thumbnail_url todavía. Solo procesa obras en estado 'activo' o 'en_espera'.
//
// Uso:
//   1. npm install @supabase/supabase-js sharp
//   2. SUPABASE_URL=https://dkkiomutzyvscnqqchqs.supabase.co \
//      SUPABASE_SERVICE_ROLE_KEY=xxxxx \
//      node scripts/backfill-thumbnails.mjs
//
// La service_role key está en Supabase > Project Settings > API. NO la subas a git.
// Es seguro relanzar el script si se corta a medias: solo coge filas con thumbnail_url IS NULL.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'proyecto_fotos';
const MAX_SIZE = 500;
const QUALITY = 75;
const CONCURRENCY = 3;
const PAUSE_BETWEEN_CHUNKS_MS = 300;
const ESTADOS_INCLUIDOS = ['activo', 'en_espera'];

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

function buildThumbPath(cleanPath) {
    const parts = cleanPath.split('/');
    const filename = parts.pop();
    const nameNoExt = filename.replace(/\.[^/.]+$/, '');
    return [...parts, 'thumbs', `${nameNoExt}.webp`].join('/');
}

// Replica la misma lógica de AsyncImage.jsx / handleDownload para resolver
// en qué bucket real vive el archivo a partir del campo `url` de la tabla `archivos`.
function resolveBucketAndPath(url) {
    if (url.startsWith('lead_fotos://')) {
        let rest = url.replace('lead_fotos://', '');
        if (rest.startsWith('http')) {
            const marker = '/lead_fotos/';
            const idx = rest.indexOf(marker);
            rest = idx >= 0 ? rest.slice(idx + marker.length) : rest;
        }
        return { bucket: 'lead_fotos', cleanPath: rest, prefix: 'lead_fotos://' };
    }
    if (url.startsWith('lead_docs://')) {
        let rest = url.replace('lead_docs://', '');
        if (rest.startsWith('http')) {
            const marker = '/lead_docs/';
            const idx = rest.indexOf(marker);
            rest = idx >= 0 ? rest.slice(idx + marker.length) : rest;
        }
        return { bucket: 'lead_docs', cleanPath: rest, prefix: 'lead_docs://' };
    }
    return { bucket: BUCKET, cleanPath: url, prefix: '' };
}

async function withRetry(fn, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const msg = err.message || String(err);
            const isTransient = /too many connections|gateway timeout|timeout/i.test(msg);
            if (!isTransient || attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
    }
}

async function processFile(row) {
    const { id, url, mime_type } = row;

    // Los vídeos no llevan miniatura de imagen — se saltan, no cuentan como fallo.
    if (mime_type?.startsWith('video/')) {
        return { id, ok: true, skipped: true };
    }

    try {
        const { bucket, cleanPath, prefix } = resolveBucketAndPath(url);

        // 1. Descargar original (con reintento si hay fallo de conexión pasajero)
        const buffer = await withRetry(async () => {
            const { data: blob, error: downloadError } = await supabase.storage
                .from(bucket)
                .download(cleanPath);
            if (downloadError) throw downloadError;
            return Buffer.from(await blob.arrayBuffer());
        });

        // 2. Generar thumbnail con sharp (respeta EXIF con .rotate())
        const thumbBuffer = await sharp(buffer)
            .rotate()
            .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toBuffer();

        // 3. Subir thumbnail al mismo bucket que el original
        const thumbRelPath = buildThumbPath(cleanPath);
        await withRetry(async () => {
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(thumbRelPath, thumbBuffer, { contentType: 'image/webp', upsert: true });
            if (uploadError) throw uploadError;
        });

        // 4. Actualizar fila — guardamos el mismo prefijo que tenía el original
        //    para que AsyncImage.jsx sepa en qué bucket buscar la miniatura.
        const thumbnailUrl = `${prefix}${thumbRelPath}`;
        await withRetry(async () => {
            const { error: dbError } = await supabase
                .from('archivos')
                .update({ thumbnail_url: thumbnailUrl })
                .eq('id', id);
            if (dbError) throw dbError;
        });

        return { id, ok: true };
    } catch (err) {
        return { id, ok: false, error: err.message || String(err) };
    }
}

async function run() {
    console.log(`Buscando fotos sin thumbnail en obras: ${ESTADOS_INCLUIDOS.join(', ')}...`);

    const { data: rows, error } = await supabase
        .from('archivos')
        .select('id, url, mime_type, proyecto_id, proyectos!inner(estado)')
        .eq('tipo', 'foto')
        .is('thumbnail_url', null)
        .in('proyectos.estado', ESTADOS_INCLUIDOS);

    if (error) {
        console.error('Error consultando archivos:', error.message);
        process.exit(1);
    }

    console.log(`${rows.length} fotos por procesar.`);

    let done = 0;
    let fails = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const chunk = rows.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(processFile));

        for (const r of results) {
            done++;
            if (r.skipped) skipped++;
            else if (!r.ok) fails.push(r);
        }

        process.stdout.write(`\rProcesadas ${done}/${rows.length} (fallos: ${fails.length}, vídeos saltados: ${skipped})`);
        await new Promise(r => setTimeout(r, PAUSE_BETWEEN_CHUNKS_MS));
    }

    console.log('\n\nTerminado.');
    if (fails.length > 0) {
        console.log(`${fails.length} fotos fallaron de verdad:`);
        fails.forEach(f => console.log(`  - ${f.id}: ${f.error}`));
    } else {
        console.log('Sin fallos reales (aparte de los vídeos, que no llevan miniatura).');
    }
}

run();

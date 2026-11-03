const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
  'http://localhost:3001',
]);

function corsHeaders(req: Request) {
  const requestOrigin = req.headers.get('Origin');
  const origin = requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : 'http://127.0.0.1:3000';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const MAX_TEXT_LENGTH = 120_000;
const MAX_FILE_LENGTH = 20_000_000;

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function getOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    const block = content.find((entry) => entry?.type === 'output_text' && typeof entry?.text === 'string');
    if (block?.text) return block.text as string;
  }
  return null;
}

async function authenticateRequest(req: Request) {
  const authorization = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization) return { ok: false, response: json(req, { error: 'unauthorized' }, 401) };
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: json(req, { error: 'Configuración de autenticación incompleta.' }, 500) };
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: supabaseAnonKey },
  });
  if (!response.ok) return { ok: false, response: json(req, { error: 'unauthorized' }, 401) };
  return { ok: true as const };
}

async function loadLibrary() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('No se puede consultar la biblioteca de partidas.');
  const params = new URLSearchParams({
    select: 'id,codigo,nombre,categoria,capitulo,categoria_detalle,unidad_base,descripcion',
    activo: 'eq.true',
    estado: 'neq.inactivo',
    order: 'codigo.asc',
    limit: '1000',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/sistemas_rendimiento?${params}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!response.ok) throw new Error('No se pudo cargar la biblioteca de partidas.');
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(req);
    return new Response('ok', {
      headers: {
        ...headers,
        'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers')
          || headers['Access-Control-Allow-Headers'],
      },
    });
  }
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const authentication = await authenticateRequest(req);
    if (!authentication.ok) return authentication.response;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) return json(req, { error: 'OPENAI_API_KEY no configurada en Supabase.' }, 503);

    const body = await req.json();
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    const file = typeof body?.file === 'string' ? body.file : '';
    const filename = typeof body?.filename === 'string' ? body.filename : 'visita-plaud.pdf';
    if (!notes && !file) return json(req, { error: 'Añade notas o un archivo exportado desde PLAUD.' }, 400);
    if (notes.length > MAX_TEXT_LENGTH) return json(req, { error: 'La transcripción es demasiado larga.' }, 413);
    if (file && (!file.startsWith('data:') || !file.includes(';base64,'))) {
      return json(req, { error: 'El archivo debe enviarse como data URL base64.' }, 400);
    }
    if (file.length > MAX_FILE_LENGTH) return json(req, { error: 'El archivo supera el tamaño máximo permitido.' }, 413);

    const library = await loadLibrary();
    const content: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: [
          'Analiza una visita comercial de una empresa española de reformas e instalaciones.',
          'La conversación puede incluir expresiones informales, rectificaciones y temas ajenos al trabajo.',
          'Extrae únicamente trabajos realmente solicitados o acordados. No inventes cantidades, precios, materiales ni alcances.',
          'Si falta una cantidad o unidad usa null y añádelo a datos_pendientes.',
          'Relaciona cada trabajo con una partida de la biblioteca solo cuando exista una correspondencia suficiente.',
          'La coincidencia debe respetar oficio, objeto, ubicación y alcance. Si cualquiera de ellos contradice la conversación, no relaciones la partida.',
          'Usa una partida de biblioteca solo con confianza igual o superior a 0.80; en caso contrario usa sistema_id y codigo null y estado_revision sin_coincidencia.',
          'Reglas críticas: PTO de fibra óptica no es CGP eléctrica; cuadro eléctrico de vivienda no es CGBT o cuadro de comunidad; puerta corredera de cristal no equivale automáticamente a puerta de paso abatible.',
          'Distingue dos partidas: las cajas de registro eléctricas para conexiones de cableado corresponden a 1.7.11; una caja destinada específicamente a alojar posteriormente una PTO de fibra corresponde a 1.9.03. Para la caja de la PTO describe la apertura, colocación, recibido y remates; excluye expresamente desconectar, manipular o reconectar la fibra y trasladar o colocar la PTO, porque corresponde a la compañía de telecomunicaciones.',
          'En líneas de fuerza de cocina, una vitrocerámica sola utiliza línea de 4 mm²; si vitrocerámica y horno comparten la misma línea, utiliza 6 mm². Si van separados, el horno tiene línea independiente y la vitrocerámica mantiene 4 mm².',
          'No expandas siglas ni conviertas términos parecidos en conceptos técnicos diferentes.',
          'Las ideas expresadas como posible, quizá, se podría o pendiente de decidir no son trabajos confirmados: colócalas en datos_pendientes u observaciones, salvo confirmación explícita del cliente.',
          'Copia exactamente el id y código de la biblioteca. Si ninguna encaja, usa sistema_id y codigo null y estado_revision sin_coincidencia.',
          'Conserva en texto_origen una frase breve de la fuente que justifique cada propuesta.',
          'Diferencia claramente peticiones del cliente, exclusiones, dudas y simples comentarios.',
          'No calcules precios. El resultado es un borrador que una persona debe revisar.',
          'Devuelve las partidas en orden real de actuación, nunca en el orden en que se mencionaron: 1 protecciones y tapado; 2 contenedor y gestión de residuos; 3 demoliciones y desmontajes; 4 albañilería y preparación de soportes; 5 instalaciones; 6 cerramientos, tabiques y falsos techos; 7 impermeabilización y nivelación; 8 revestimientos, alicatados y solados; 9 carpintería y equipamiento; 10 pintura y acabados; 11 aparatos y remates; 12 pruebas, repasos y limpieza final.',
          'Regla obligatoria de planificación: si hay cualquier demolición, desmontaje, picado o levantado, incluye también la partida 11.1.03 de alquiler de contenedor de obra aunque el cliente no la mencione. Usa cantidad 1 como previsión inicial y explica en texto_origen que se añadió automáticamente por existir demoliciones.',
          'Extrae tambien todas las mediciones expresas de la conversacion. No estimes dimensiones que no se hayan dicho.',
          'Si una estancia rectangular aporta largo, ancho y altura, crea mediciones separadas para suelo, techo y paredes cuando la conversacion indique que esos elementos se van a ejecutar.',
          'Calcula suelo y techo como largo por ancho; calcula el conjunto de paredes como 2 por (largo mas ancho) por altura; calcula un pano de pared como largo por altura.',
          'Regla de medicion ORKALED: en pintura y alicatado se usa la superficie bruta y nunca se descuentan puertas ni ventanas, porque los cortes, protecciones y remates compensan los huecos.',
          'Cada medicion debe conservar una formula legible y el fragmento exacto que la origino. Todas las mediciones extraidas quedan pendientes de revision humana.',
        ].join(' '),
      },
      {
        type: 'input_text',
        text: `BIBLIOTECA DE PARTIDAS DEL ERP:\n${JSON.stringify(library)}`,
      },
    ];
    if (notes) content.push({ type: 'input_text', text: `NOTAS O TRANSCRIPCIÓN:\n${notes}` });
    if (file) content.push({ type: 'input_file', filename, file_data: file });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'visita_presupuesto',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['resumen', 'necesidades_cliente', 'datos_pendientes', 'observaciones', 'mediciones', 'partidas'],
              properties: {
                resumen: { type: 'string' },
                necesidades_cliente: { type: 'array', items: { type: 'string' } },
                datos_pendientes: { type: 'array', items: { type: 'string' } },
                observaciones: { type: 'array', items: { type: 'string' } },
                mediciones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'estancia', 'elemento', 'largo', 'ancho', 'alto', 'resultado',
                      'unidad', 'formula', 'acabado', 'texto_origen', 'fuente',
                      'estado_revision', 'observaciones',
                    ],
                    properties: {
                      estancia: { type: 'string' },
                      elemento: {
                        type: 'string',
                        enum: ['suelo', 'techo', 'paredes', 'pared', 'tabique', 'rodapie', 'puerta', 'ventana', 'otro'],
                      },
                      largo: { type: ['number', 'null'] },
                      ancho: { type: ['number', 'null'] },
                      alto: { type: ['number', 'null'] },
                      resultado: { type: ['number', 'null'] },
                      unidad: { type: 'string' },
                      formula: { type: 'string' },
                      acabado: { type: ['string', 'null'] },
                      texto_origen: { type: 'string' },
                      fuente: { type: 'string', enum: ['transcripcion'] },
                      estado_revision: { type: 'string', enum: ['pendiente'] },
                      observaciones: { type: ['string', 'null'] },
                    },
                  },
                },
                partidas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'sistema_id', 'codigo', 'capitulo', 'descripcion', 'zona', 'unidad',
                      'cantidad', 'texto_origen', 'confianza', 'estado_revision',
                    ],
                    properties: {
                      sistema_id: { type: ['string', 'null'] },
                      codigo: { type: ['string', 'null'] },
                      capitulo: { type: ['string', 'null'] },
                      descripcion: { type: 'string' },
                      zona: { type: ['string', 'null'] },
                      unidad: { type: ['string', 'null'] },
                      cantidad: { type: ['number', 'null'] },
                      texto_origen: { type: 'string' },
                      confianza: { type: 'number', minimum: 0, maximum: 1 },
                      estado_revision: {
                        type: 'string',
                        enum: ['propuesta', 'sin_coincidencia'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI respondió con estado ${response.status}.`;
      console.error('analyze-visit-notes OpenAI:', message);
      return json(req, { error: message }, 502);
    }
    const outputText = getOutputText(payload);
    if (!outputText) return json(req, { error: 'OpenAI no devolvió datos estructurados.' }, 502);
    return json(req, JSON.parse(outputText));
  } catch (error) {
    console.error('analyze-visit-notes:', error instanceof Error ? error.message : error);
    return json(req, { error: error instanceof Error ? error.message : 'Error analizando la visita.' }, 500);
  }
});

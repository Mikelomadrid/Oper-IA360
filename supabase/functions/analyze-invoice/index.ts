const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BASE64_LENGTH = 20_000_000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

  if (!authorization) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: json({ error: 'Configuración de autenticación incompleta.' }, 500) };
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: supabaseAnonKey,
    },
  });

  if (!authResponse.ok) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }

  return { ok: true as const };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers':
          req.headers.get('Access-Control-Request-Headers') || corsHeaders['Access-Control-Allow-Headers'],
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authentication = await authenticateRequest(req);
    if (!authentication.ok) return authentication.response;

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return json({ error: 'OPENAI_API_KEY no configurada en Supabase.' }, 503);
    }

    const body = await req.json();
    const dataUrl = typeof body?.image === 'string' ? body.image : '';
    if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
      return json({ error: 'La imagen o PDF debe enviarse como data URL base64.' }, 400);
    }
    if (dataUrl.length > MAX_BASE64_LENGTH) {
      return json({ error: 'El documento supera el tamaño máximo permitido.' }, 413);
    }

    const isPdf = dataUrl.startsWith('data:application/pdf;');
    const documentBlock = isPdf
      ? { type: 'input_file', filename: 'factura.pdf', file_data: dataUrl }
      : { type: 'input_image', image_url: dataUrl, detail: 'high' };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Extrae esta factura de proveedor española.',
                'No inventes referencias ni importes: usa null o cadena vacía cuando no sean legibles.',
                'Distingue emisor/proveedor y receptor/destinatario. El receptor es quien compra; extrae su nombre y NIF/CIF solo si aparecen expresamente.',
                'El número del documento puede figurar como número de factura, factura simplificada, ticket, recibo u operación; conserva el texto impreso y usa null si no existe.',
                'Separa cada artículo o material en una línea y conserva sus unidades reales.',
                'Si el concepto indica un envase de compra como palé, saco, caja, rollo o pack, usa ese envase como unidad; no lo conviertas a ud aunque el texto indique cuántas piezas contiene.',
                'Los importes de cabecera y línea deben ser números, sin símbolos monetarios.',
              ].join(' '),
            },
            documentBlock,
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'factura_materiales',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: [
                'proveedor_nombre', 'proveedor_cif', 'receptor_nombre', 'receptor_cif', 'numero_factura', 'fecha',
                'subtotal', 'iva_importe', 'iva_porcentaje', 'total', 'confianza_ocr', 'lineas',
              ],
              properties: {
                proveedor_nombre: { type: ['string', 'null'] },
                proveedor_cif: { type: ['string', 'null'] },
                receptor_nombre: { type: ['string', 'null'] },
                receptor_cif: { type: ['string', 'null'] },
                numero_factura: { type: ['string', 'null'] },
                fecha: { type: ['string', 'null'], description: 'Fecha YYYY-MM-DD' },
                subtotal: { type: ['number', 'null'] },
                iva_importe: { type: ['number', 'null'] },
                iva_porcentaje: { type: ['number', 'null'], description: 'Porcentaje, por ejemplo 21' },
                total: { type: ['number', 'null'] },
                confianza_ocr: { type: ['number', 'null'], minimum: 0, maximum: 1 },
                lineas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['referencia', 'nombre', 'categoria', 'cantidad', 'unidad', 'precio_unitario', 'total_linea'],
                    properties: {
                      referencia: { type: ['string', 'null'] },
                      nombre: { type: 'string' },
                      categoria: { type: ['string', 'null'] },
                      cantidad: { type: ['number', 'null'] },
                      unidad: { type: ['string', 'null'] },
                      precio_unitario: { type: ['number', 'null'] },
                      total_linea: { type: ['number', 'null'] },
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
      console.error('analyze-invoice OpenAI:', message);
      return json({ error: message }, 502);
    }

    const outputText = getOutputText(payload);
    if (!outputText) return json({ error: 'OpenAI no devolvió datos estructurados.' }, 502);

    return json(JSON.parse(outputText));
  } catch (error) {
    console.error('analyze-invoice:', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'Error analizando la factura.' }, 500);
  }
});

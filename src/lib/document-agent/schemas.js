export const DOCUMENT_AGENT_TYPES = {
  invoice: 'invoice',
  budget: 'budget',
  measurement: 'measurement',
  delivery_note: 'delivery_note',
  generic: 'generic',
};

export const DOCUMENT_AGENT_LABELS = {
  invoice: 'Factura',
  budget: 'Presupuesto',
  measurement: 'Mediciones',
  delivery_note: 'Albarán',
  generic: 'Documento',
};

export const DOCUMENT_AGENT_PROMPTS = {
  invoice: `Analiza este documento como factura o ticket de proveedor en España. Responde SOLO JSON válido.
Reglas obligatorias:
- Detecta importes aunque vengan con coma decimal.
- Convierte fechas a formato YYYY-MM-DD si puedes.
- Si es ticket sin número de factura claro, deja invoice_number como cadena vacía.
- Si no ves líneas fiables, devuelve lines: [].
- confidence debe ir de 0 a 100.
- warnings debe explicar dudas reales: ticket borroso, CIF dudoso, total incoherente, etc.
- category en líneas debe ser una de: electricidad, fontanería, pintura, albañilería, herramientas, materiales, otro.
{
  "type": "invoice",
  "supplier_name": "",
  "supplier_tax_id": "",
  "invoice_number": "",
  "issue_date": "YYYY-MM-DD o null",
  "due_date": "YYYY-MM-DD o null",
  "currency": "EUR",
  "subtotal": 0,
  "tax_rate": 21,
  "tax_amount": 0,
  "total": 0,
  "summary": "",
  "lines": [
    {
      "reference": "",
      "description": "",
      "quantity": 1,
      "unit": "ud",
      "unit_price": 0,
      "line_total": 0,
      "category": "materiales"
    }
  ],
  "confidence": 0,
  "warnings": []
}`,
  budget: `Analiza este documento como presupuesto de obra. Responde SOLO JSON válido.
{
  "type": "budget",
  "title": "",
  "customer_name": "",
  "issue_date": "YYYY-MM-DD o null",
  "currency": "EUR",
  "total": 0,
  "sections": [
    {
      "section": "",
      "items": [
        {
          "code": "",
          "description": "",
          "work_type": "albanileria|fontaneria|electricidad|pintura|pladur|carpinteria|otro",
          "quantity": 0,
          "unit": "m²",
          "unit_price": 0,
          "line_total": 0
        }
      ]
    }
  ],
  "confidence": 0,
  "warnings": []
}`,
  measurement: `Analiza este PDF o imagen como documento de mediciones. Responde SOLO JSON válido.
{
  "type": "measurement",
  "title": "",
  "project_name": "",
  "items": [
    {
      "code": "",
      "description": "",
      "unit": "m²",
      "quantity": 0,
      "unit_price": null
    }
  ],
  "confidence": 0,
  "warnings": []
}`,
  delivery_note: `Analiza este documento como albarán. Responde SOLO JSON válido.
{
  "type": "delivery_note",
  "supplier_name": "",
  "supplier_tax_id": "",
  "document_number": "",
  "issue_date": "YYYY-MM-DD o null",
  "summary": "",
  "lines": [
    {
      "reference": "",
      "description": "",
      "quantity": 0,
      "unit": "ud"
    }
  ],
  "confidence": 0,
  "warnings": []
}`,
  generic: `Analiza este documento y devuelve un resumen estructurado. Responde SOLO JSON válido.
{
  "type": "generic",
  "title": "",
  "document_kind": "",
  "issue_date": "YYYY-MM-DD o null",
  "summary": "",
  "key_points": [""],
  "entities": [""],
  "confidence": 0,
  "warnings": []
}`,
};

export function getDocumentAgentPrompt(type) {
  return DOCUMENT_AGENT_PROMPTS[type] || DOCUMENT_AGENT_PROMPTS.generic;
}

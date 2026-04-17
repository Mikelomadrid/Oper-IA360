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
  invoice: `Analiza este documento como factura, ticket o justificante de gasto en España. Responde SOLO JSON válido.
Reglas obligatorias:
- Detecta importes aunque vengan con coma decimal.
- Convierte fechas a formato YYYY-MM-DD si puedes.
- Si es ticket sin número de factura claro, deja invoice_number como cadena vacía.
- En tickets de aparcamiento, start_time y end_time son obligatorios si aparecen en el documento.
- vehicle_plate debe salir sin espacios raros, por ejemplo 5060HBP o 5060 HBP.
- parking_zone debe recoger valores como verde, azul, SER, ORA, etc.
- parking_area debe recoger barrio, distrito o código de zona si aparece.
- raw_text debe incluir el texto OCR completo visible.

- Si no ves líneas fiables, devuelve lines: [].
- confidence debe ir de 0 a 100.
- warnings debe explicar dudas reales: ticket borroso, CIF dudoso, total incoherente, etc.
- category en líneas debe ser una de: electricidad, fontanería, pintura, albañilería, herramientas, materiales, parking, otro.
- Si es un ticket de aparcamiento, SER, ORA o similar, rellena también vehicle_plate, start_time, end_time, parking_zone y parking_area si aparecen.
{
 "type": "invoice",
 "document_type": "invoice|parking_ticket|receipt|other",
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
 "vehicle_plate": "",
 "start_time": "",
 "end_time": "",
 "parking_zone": "",
 "parking_area": "",
 "raw_text": "",
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

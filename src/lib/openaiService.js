import { analyzeInvoiceWithDocumentAgent } from '@/lib/document-agent/service';

/**
 * Wrapper legado para mantener compatibilidad con el escáner de facturas.
 * Ahora usa document-agent como backend unificado.
 */
export async function analyzeInvoice(file) {
  try {
    return await analyzeInvoiceWithDocumentAgent(file);
  } catch (error) {
    console.error('Analysis Service Error:', error);
    throw error;
  }
}

import { toast } from '@/components/ui/use-toast';

/**
 * Base URL del servicio documental (Flopy) que sirve originales/thumbnails de facturas escaneadas.
 * Es la Edge Function documentos-proxy de Supabase, que guarda la clave interna (X-Flopy-Key)
 * y hace de intermediario seguro hacia el NAS. El frontend nunca debe apuntar directamente
 * a documentos.orkaled.cloud ni llevar claves internas.
 */
export const DOCUMENT_API_BASE = import.meta.env.VITE_DOCUMENT_API_BASE || '';

/**
 * Pide al proxy documental la lista de páginas escaneadas de una factura y las devuelve
 * ordenadas por número de página. No abre nada por sí misma (eso lo decide quien la use,
 * según si hay 1 página o varias) — ver useFacturaViewer.
 *
 * @param {string} facturaGastoId - facturas_gastos.id (NO gasto_id)
 * @returns {Promise<Array|null>} documentos ordenados por pagina, o null si hubo error/no hay nada
 */
export async function fetchDocumentosFactura(facturaGastoId) {
  if (!facturaGastoId) return null;

  if (!DOCUMENT_API_BASE) {
    toast({
      title: 'Visor no configurado',
      description: 'El visor de facturas todavía no está configurado.',
      variant: 'destructive',
    });
    return null;
  }

  try {
    const res = await fetch(`${DOCUMENT_API_BASE}/api/facturas-gastos/${facturaGastoId}/documentos`);
    const data = await res.json();

    if (!res.ok || !data.ok || !Array.isArray(data.documentos) || data.documentos.length === 0) {
      toast({
        title: 'Factura no disponible',
        description: 'No se ha podido abrir la factura escaneada.',
        variant: 'destructive',
      });
      return null;
    }

    return [...data.documentos].sort((a, b) => (a.pagina ?? 0) - (b.pagina ?? 0));
  } catch (error) {
    console.error('Error obteniendo documentos de la factura:', error);
    toast({
      title: 'Error',
      description: 'No se ha podido abrir la factura escaneada.',
      variant: 'destructive',
    });
    return null;
  }
}

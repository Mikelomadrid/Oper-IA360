import { useState, useCallback } from 'react';
import { fetchDocumentosFactura } from '@/lib/documentosFactura';

/**
 * Hook para el botón "ojo" de ver factura escaneada.
 * - Si la factura tiene 1 sola página, la abre directamente en pestaña nueva.
 * - Si tiene varias, guarda el estado para que el componente muestre <FacturaViewerModal />.
 *
 * Uso:
 *   const { visorFactura, abrirFacturaEscaneada, cerrarVisor, paginaSiguiente, paginaAnterior, irAPagina } = useFacturaViewer();
 *   <button onClick={() => abrirFacturaEscaneada(gasto.factura_gasto_id)}><Eye /></button>
 *   <FacturaViewerModal visor={visorFactura} onClose={cerrarVisor} onPrev={paginaAnterior} onNext={paginaSiguiente} onSelect={irAPagina} />
 */
export function useFacturaViewer() {
  const [visorFactura, setVisorFactura] = useState(null); // { documentos, indice } | null

  const abrirFacturaEscaneada = useCallback(async (facturaGastoId) => {
    const documentos = await fetchDocumentosFactura(facturaGastoId);
    if (!documentos || documentos.length === 0) return;

    if (documentos.length === 1) {
      window.open(documentos[0].original_url, '_blank', 'noopener,noreferrer');
      return;
    }

    setVisorFactura({ documentos, indice: 0 });
  }, []);

  const cerrarVisor = useCallback(() => setVisorFactura(null), []);

  const paginaSiguiente = useCallback(() => {
    setVisorFactura(prev => {
      if (!prev) return prev;
      const indice = Math.min(prev.indice + 1, prev.documentos.length - 1);
      return { ...prev, indice };
    });
  }, []);

  const paginaAnterior = useCallback(() => {
    setVisorFactura(prev => {
      if (!prev) return prev;
      const indice = Math.max(prev.indice - 1, 0);
      return { ...prev, indice };
    });
  }, []);

  const irAPagina = useCallback((indice) => {
    setVisorFactura(prev => {
      if (!prev) return prev;
      const clamped = Math.max(0, Math.min(indice, prev.documentos.length - 1));
      return { ...prev, indice: clamped };
    });
  }, []);

  return { visorFactura, abrirFacturaEscaneada, cerrarVisor, paginaSiguiente, paginaAnterior, irAPagina };
}

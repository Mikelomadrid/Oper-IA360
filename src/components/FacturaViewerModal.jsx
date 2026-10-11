import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * Visor modal para facturas escaneadas con varias páginas.
 * Se renderiza junto al hook useFacturaViewer(); si visor es null no pinta nada.
 */
const FacturaViewerModal = ({ visor, onClose, onPrev, onNext, onSelect }) => {
  if (!visor) return null;

  const { documentos, indice } = visor;
  const documentoActual = documentos[indice];
  const total = documentos.length;
  const esPrimera = indice === 0;
  const esUltima = indice === total - 1;

  return (
    <Dialog open={!!visor} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Factura escaneada — Página {indice + 1} de {total}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg border min-h-[400px] max-h-[65vh] overflow-auto p-2">
            <img
              key={documentoActual.documento_id}
              src={documentoActual.original_url}
              alt={`Página ${documentoActual.pagina ?? indice + 1} de la factura`}
              className="max-w-full max-h-[60vh] object-contain"
            />
          </div>

          {total > 1 && (
            <div className="flex gap-2 overflow-x-auto w-full justify-center pb-1">
              {documentos.map((doc, idx) => (
                <button
                  key={doc.documento_id}
                  type="button"
                  onClick={() => onSelect(idx)}
                  title={`Ir a la página ${doc.pagina ?? idx + 1}`}
                  className={`shrink-0 rounded-md overflow-hidden border transition-opacity ${
                    idx === indice ? 'ring-2 ring-blue-500 opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={doc.thumbnail_url}
                    alt={`Miniatura página ${doc.pagina ?? idx + 1}`}
                    className="h-16 w-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={onPrev} disabled={esPrimera}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {indice + 1} de {total}</span>
            <Button variant="outline" onClick={onNext} disabled={esUltima}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.open(documentoActual.original_url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Abrir en pestaña nueva
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FacturaViewerModal;

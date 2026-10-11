import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, User, Calendar, ArrowRight, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusColor, getStatusTextColor } from '@/utils/statusColors';

// Columnas visibles del tablero. Solo estos 4 estados "activos" tienen columna propia;
// el resto de estados (CONTACTADO, VISITA AGENDADA, y todos los finalizados) no se
// muestran aquí — CONTACTADO/VISITA AGENDADA se consultan en el histórico/otra vista,
// y los finalizados se alcanzan con el botón "Mover a siguiente fase" de cada tarjeta.
const COLUMNS = [
  { ui: 'NUEVO', internal: 'nuevo' },
  { ui: 'VISITADO', internal: 'visitado' },
  { ui: 'PRESUPUESTADO', internal: 'presupuestado' },
  { ui: 'FACTURADO', internal: 'facturado' },
];

// Estados de salida (todos finalizados, van al Archivo Histórico). Antes se elegían
// arrastrando a la columna "SIGUIENTE FASE"; ahora se elige desde el botón (→) de
// cada tarjeta, que abre este mismo diálogo.
const EXIT_OPTIONS = [
  { ui: 'REALIZADO', internal: 'realizado' },
  { ui: 'ACEPTADO', internal: 'aceptado' },
  { ui: 'RECHAZADO', internal: 'rechazado' },
  { ui: 'CANCELADO', internal: 'cancelado' },
  { ui: 'COBRADO', internal: 'cobrado' },
  { ui: 'CERRADO', internal: 'cerrado' },
];

const COLUMN_INTERNALS = COLUMNS.map(c => c.internal);

// historialGroups: array [ [claveMes, { label, items }], ... ] ya agrupado y ordenado
// (desc) por el padre (PartesAdminView), igual que el Archivo Histórico existente.
const PartesKanban = ({ partes, onStatusChange, onCardClick, canDrag = false, getTechnicianName, historialGroups = [] }) => {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Estado para el diálogo de salida (ahora se abre desde el botón de la tarjeta,
  // ya no desde un drop en columna).
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitParteId, setExitParteId] = useState(null);

  // Mes abierto dentro de la columna HISTORIAL (persistido)
  const [historialMonthOpen, setHistorialMonthOpen] = useState(() => {
    try { return localStorage.getItem('partes_kanban_historial_mes_abierto') || null; } catch { return null; }
  });

  // Agrupa los partes por estado interno en las 4 columnas activas.
  // Partes en cualquier otro estado (contactado, visita_agendada, o finalizados
  // como realizado/aceptado/rechazado/cancelado/cobrado/cerrado) no se muestran aquí.
  const grouped = useMemo(() => {
    const g = { nuevo: [], visitado: [], presupuestado: [], facturado: [] };
    (partes || []).forEach(p => {
      const st = (p.estado || '').toLowerCase();
      if (g[st]) g[st].push(p);
    });
    return g;
  }, [partes]);

  const handleDragStart = (e, parteId) => {
    if (!canDrag) return;
    e.dataTransfer.setData('text/plain', parteId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(parteId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const allowDrop = (e, colKey) => {
    if (!canDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  };

  const getDroppedParte = (e) => {
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return null;
    return (partes || []).find(p => p.id === id) || { id };
  };

  // Drop sobre una columna normal: cambia el estado directamente (si es distinto).
  const handleDropColumn = (e, internal) => {
    if (!canDrag) return;
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null); // limpiar aquí: al remontarse la tarjeta, 'dragend' puede no dispararse
    const parte = getDroppedParte(e);
    if (!parte) return;
    const current = (parte.estado || '').toLowerCase();
    if (current === internal) return; // misma columna, no hacer nada
    onStatusChange(parte.id, internal);
  };

  // Abre el selector de estado de salida para un parte concreto (botón → de la tarjeta)
  const openExitDialog = (parteId) => {
    setExitParteId(parteId);
    setExitDialogOpen(true);
  };

  const confirmExit = (internal) => {
    if (exitParteId) {
      onStatusChange(exitParteId, internal);
    }
    setExitDialogOpen(false);
    setExitParteId(null);
  };

  const renderCard = (parte) => {
    const isDragging = draggingId === parte.id;
    const tecnicoNombre = (getTechnicianName && getTechnicianName(parte)) || parte.tecnico_nombre || 'Sin asignar';
    return (
      <Card
        key={parte.id}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, parte.id)}
        onDragEnd={handleDragEnd}
        onClick={() => onCardClick && onCardClick(parte.id)}
        className={cn(
          'p-3 bg-card border shadow-sm rounded-lg select-none group transition-all',
          canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          isDragging ? 'opacity-40 ring-2 ring-primary' : 'hover:shadow-md hover:border-primary/40'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
            {parte.cliente_nombre}
          </span>
          {canDrag && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/60 hover:text-primary"
                onClick={(e) => { e.stopPropagation(); openExitDialog(parte.id); }}
                title="Mover a siguiente fase"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground/40 shrink-0">
                <circle cx="9" cy="6" r="1" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="18" r="1" />
                <circle cx="15" cy="6" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="18" r="1" />
              </svg>
            </div>
          )}
        </div>

        <Badge
          variant="secondary"
          className="font-mono text-[10px] h-5 px-1.5 mt-2 shadow-none bg-muted border border-border text-muted-foreground"
        >
          {parte.custom_id || `#${String(parte.id).slice(0, 8)}`}
        </Badge>

        {parte.direccion_servicio && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{parte.direccion_servicio}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{tecnicoNombre}</span>
          </span>
          {parte.created_at && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {format(new Date(parte.created_at), 'dd MMM', { locale: es })}
            </span>
          )}
        </div>
      </Card>
    );
  };

  // Tarjeta de solo lectura para la columna HISTORIAL (sin drag, sin botón de salida)
  const renderHistorialCard = (parte) => {
    const tecnicoNombre = (getTechnicianName && getTechnicianName(parte)) || parte.tecnico_nombre || 'Sin asignar';
    const statusLabel = parte.estado_ui || parte.estado;
    return (
      <Card
        key={parte.id}
        onClick={() => onCardClick && onCardClick(parte.id)}
        className="p-3 bg-card border shadow-sm rounded-lg select-none cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
      >
        <span className="font-semibold text-sm text-foreground line-clamp-2 leading-tight block">
          {parte.cliente_nombre}
        </span>

        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          <Badge
            variant="secondary"
            className="font-mono text-[10px] h-5 px-1.5 shadow-none bg-muted border border-border text-muted-foreground"
          >
            {parte.custom_id || `#${String(parte.id).slice(0, 8)}`}
          </Badge>
          {statusLabel && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 uppercase font-semibold border-none"
              style={{ backgroundColor: getStatusColor(statusLabel), color: getStatusTextColor(statusLabel) }}
            >
              {statusLabel}
            </Badge>
          )}
        </div>

        {parte.direccion_servicio && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{parte.direccion_servicio}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{tecnicoNombre}</span>
          </span>
        </div>
      </Card>
    );
  };

  // Contenido de la columna HISTORIAL: lista de meses, o (si hay uno seleccionado)
  // las tarjetas de ese mes con botón para volver. Mismo patrón que Obras/Leads.
  const renderHistorialContent = () => {
    if (historialMonthOpen) {
      const found = historialGroups.find(([key]) => key === historialMonthOpen);
      if (found) {
        const [, group] = found;
        return (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 -ml-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setHistorialMonthOpen(null);
                try { localStorage.removeItem('partes_kanban_historial_mes_abierto'); } catch {}
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Volver al historial
            </Button>
            <div className="text-xs font-semibold capitalize text-muted-foreground px-0.5">
              {group.label} · {group.items.length}
            </div>
            {group.items.map(p => renderHistorialCard(p))}
          </div>
        );
      }
    }

    if (!historialGroups || historialGroups.length === 0) {
      return (
        <div className="h-32 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-center px-3 text-muted-foreground">
          <Archive className="w-5 h-5 opacity-60" />
          Aún no hay partes archivados
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {historialGroups.map(([key, group]) => (
          <button
            key={key}
            onClick={() => {
              setHistorialMonthOpen(key);
              try { localStorage.setItem('partes_kanban_historial_mes_abierto', key); } catch {}
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
          >
            <span className="text-sm font-medium capitalize truncate">{group.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{group.items.length}</Badge>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    );
  };

  const totalHistorial = (historialGroups || []).reduce((sum, [, g]) => sum + g.items.length, 0);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => {
          const items = grouped[col.internal] || [];
          const color = getStatusColor(col.ui);
          const isOver = dragOverCol === col.internal;
          return (
            <div
              key={col.internal}
              onDragOver={(e) => allowDrop(e, col.internal)}
              onDragLeave={() => setDragOverCol(prev => (prev === col.internal ? null : prev))}
              onDrop={(e) => handleDropColumn(e, col.internal)}
              className={cn(
                'flex flex-col w-[280px] shrink-0 rounded-xl border bg-muted/20 transition-colors',
                isOver && canDrag ? 'border-primary border-2 bg-primary/5' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b bg-card/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground">{col.ui}</span>
                </div>
                <Badge variant="secondary" className="h-5 px-2 text-[11px] font-normal">{items.length}</Badge>
              </div>

              <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-360px)] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 italic border border-dashed rounded-lg">
                    Vacío
                  </div>
                ) : (
                  items.map(renderCard)
                )}
              </div>
            </div>
          );
        })}

        {/* Columna HISTORIAL: reemplaza el antiguo dropzone "Siguiente fase".
            Muestra los partes archivados agrupados por mes; para mover un parte
            a un estado final se usa el botón (→) de su tarjeta en las columnas activas. */}
        <div
          className="flex flex-col w-[280px] shrink-0 rounded-xl border border-border/60 bg-muted/20 transition-colors"
        >
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl"
            style={{ backgroundColor: '#d1fae5', borderColor: '#6ee7b7' }}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5" style={{ color: '#047857' }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#047857' }}>Historial</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/70" style={{ color: '#047857' }}>
              {totalHistorial}
            </span>
          </div>

          <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-360px)] overflow-y-auto">
            {renderHistorialContent()}
          </div>
        </div>
      </div>

      {/* Diálogo de selección de estado de salida (ahora abierto desde el botón → de la tarjeta) */}
      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover a siguiente fase</DialogTitle>
            <DialogDescription>
              Elige el nuevo estado del parte. Saldrá del tablero activo y pasará al Archivo Histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {EXIT_OPTIONS.map((opt) => {
              const bg = getStatusColor(opt.ui);
              const text = getStatusTextColor(opt.ui);
              return (
                <button
                  key={opt.internal}
                  type="button"
                  onClick={() => confirmExit(opt.internal)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border hover:bg-muted transition-colors text-left"
                >
                  <span
                    className="inline-flex items-center justify-center text-[11px] font-bold uppercase rounded-md px-2 py-1 shrink-0"
                    style={{ backgroundColor: bg, color: text }}
                  >
                    {opt.ui}
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="outline" onClick={() => setExitDialogOpen(false)}>Cancelar</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PartesKanban;

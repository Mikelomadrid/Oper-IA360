import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Bolita verde parpadeante que indica "hay una actualización sin revisar".
 * No se renderiza nada si `show` es falso.
 *
 * Ejemplo de uso en una fila de tabla o tarjeta de Kanban:
 *
 *   import AvisoBolita, { AVISO_ROW_CLASS } from '@/components/AvisoBolita';
 *   const hasAviso = pendingPartes.has(parte.id);
 *
 *   <tr className={cn(hasAviso && AVISO_ROW_CLASS)}>
 *     <td className="flex items-center gap-2">
 *       <AvisoBolita show={hasAviso} />
 *       {parte.custom_id}
 *     </td>
 *     ...
 *   </tr>
 */
export default function AvisoBolita({ show, className }) {
  if (!show) return null;
  return (
    <span
      className={cn('relative inline-flex h-2.5 w-2.5 shrink-0', className)}
      title="Actualización sin revisar"
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

// Clase de utilidad para sombrear el fondo de la fila/tarjeta con aviso pendiente.
// Úsala junto a cn(): cn(hasAviso && AVISO_ROW_CLASS, otrasClases...)
export const AVISO_ROW_CLASS = 'bg-green-50/70 dark:bg-green-950/20 border-l-2 border-l-green-500';

import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estadoMap, getStatusLabel } from '@/utils/leadStatus';

export const EstadoBadge = ({ estado }) => {
  let currentStatus = estado;
  if (currentStatus === 'aprobado' || currentStatus === 'convertido') currentStatus = 'aceptado';

  // Fallback to 'nuevo' if undefined, ensuring visual stability
  const style = estadoMap[currentStatus] || estadoMap.nuevo;
  const label = getStatusLabel(currentStatus);
  
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-bold border uppercase whitespace-nowrap shadow-sm transition-colors")}
      style={{ 
        backgroundColor: style.bg, 
        color: style.text, 
        borderColor: style.br 
      }}
    >
      {currentStatus === 'visita_agendada' && <Calendar className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
};

export default EstadoBadge;
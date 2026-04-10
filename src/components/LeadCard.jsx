import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Building2, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FORM_STATUS_OPTIONS, ESTADO_LABELS, estadoMap } from '@/utils/leadStatus';

const LeadCard = ({ lead, index, onUpdateStatus, onDelete }) => {
  // Normalize status for visual mapping
  let currentStatus = lead.estado;
  if (currentStatus === 'aprobado' || currentStatus === 'convertido') currentStatus = 'aceptado';

  // Map normalized status to Gradient Colors 
  // (We use approximate Tailwind classes here for gradients as they expect classes, 
  // but they align with the STATUS_COLORS palette: Blue, Sky, Violet, Fuchsia, Amber, Emerald, Red, Slate)
  const getGradient = (status) => {
    switch (status) {
      case 'nuevo': return 'from-blue-500 to-blue-600';           // #3b82f6
      case 'contactado': return 'from-sky-500 to-sky-600';        // #0ea5e9
      case 'visita_agendada': return 'from-violet-500 to-purple-600'; // #8b5cf6
      case 'visitado': return 'from-fuchsia-500 to-pink-600';     // #d946ef
      case 'presupuestado': return 'from-amber-500 to-orange-500';// #f59e0b
      case 'aceptado': return 'from-emerald-500 to-green-600';    // #10b981
      case 'rechazado': return 'from-red-500 to-rose-600';        // #ef4444
      case 'cancelado': return 'from-slate-500 to-slate-600';     // #64748b
      case 'anulado': return 'from-gray-400 to-gray-500';         // #9ca3af
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const gradientClass = getGradient(currentStatus);
  const style = estadoMap[currentStatus] || estadoMap.nuevo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="glass-effect rounded-2xl p-6 relative overflow-hidden group border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all"
    >
      {/* Dynamic Colored Blob in Background matching chart color */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradientClass} opacity-10 rounded-full -mr-16 -mt-16 blur-2xl`} />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <h3 className="text-xl font-bold mb-1 text-slate-800 dark:text-slate-100">{lead.nombre_contacto}</h3>
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm"
            style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.br}` }}
          >
            {ESTADO_LABELS[currentStatus] || 'DESCONOCIDO'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(lead.id)}
          className="hover:bg-red-500/10 hover:text-red-500 text-slate-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3 mb-4 relative z-10">
        {lead.base_imponible !== null && lead.base_imponible !== undefined && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm text-slate-500 font-medium">Presupuesto:</span>
            <span className="font-bold text-emerald-600">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(lead.base_imponible)}
            </span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.telefono && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>{lead.telefono}</span>
          </div>
        )}
        {lead.nombre_empresa && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span>{lead.nombre_empresa}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
          <Calendar className="w-4 h-4" />
          <span>{new Date(lead.fecha_creacion).toLocaleDateString('es-ES')}</span>
        </div>
      </div>

      <div className="flex gap-2 relative z-10 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
        <select
          value={currentStatus}
          onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          {FORM_STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  );
};

export default LeadCard;
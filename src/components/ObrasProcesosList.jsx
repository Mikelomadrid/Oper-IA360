import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertCircle, CheckCircle2, Clock, ShieldAlert, Euro } from 'lucide-react';
import { formatCurrency, fmtMadrid } from '@/lib/utils';

const ObrasProcesosList = ({ obras, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (obras.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/10 rounded-xl border-2 border-dashed border-muted">
        <p className="text-muted-foreground">No se encontraron obras activas con procesos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-500">
      {obras.map((obra) => {
        const hasPending = (obra.pasos_pendientes > 0 || obra.aprobaciones_pendientes > 0);
        const hasExtras = obra.extras_solicitados_eur > 0;

        return (
          <Card 
            key={obra.obra_id}
            className={`group relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border-l-4 ${hasPending ? 'border-l-red-500 shadow-red-500/10' : 'border-l-green-500'}`}
            onClick={() => navigate(`/gestion/obras/${obra.obra_id}`)}
          >
            {/* Hover Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardContent className="p-5 flex flex-col h-full gap-4">
              
              {/* Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg leading-tight truncate" title={obra.nombre}>
                    {obra.nombre}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Incio: {obra.fecha_inicio ? fmtMadrid(obra.fecha_inicio, 'date') : 'N/A'}</span>
                  </div>
                </div>
                <div className="shrink-0">
                    {hasPending ? (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 animate-pulse">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    )}
                </div>
              </div>

              {/* Status Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize bg-background/50">
                    {obra.estado?.replace('_', ' ')}
                </Badge>
                {obra.ejecuciones_abiertas > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">
                        {obra.ejecuciones_abiertas} Procesos
                    </Badge>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
                <div className={`p-2 rounded-lg border ${obra.pasos_pendientes > 0 ? 'bg-red-50 border-red-100' : 'bg-muted/30 border-transparent'}`}>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block mb-0.5">Pasos Pend.</span>
                    <div className="flex items-center gap-1.5">
                        <ShieldAlert className={`w-4 h-4 ${obra.pasos_pendientes > 0 ? 'text-red-500' : 'text-muted-foreground/50'}`} />
                        <span className={`text-lg font-bold ${obra.pasos_pendientes > 0 ? 'text-red-700' : 'text-foreground'}`}>
                            {obra.pasos_pendientes || 0}
                        </span>
                    </div>
                </div>

                <div className={`p-2 rounded-lg border ${hasExtras ? 'bg-amber-50 border-amber-100' : 'bg-muted/30 border-transparent'}`}>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block mb-0.5">Extras Sol.</span>
                    <div className="flex items-center gap-1.5">
                        <Euro className={`w-4 h-4 ${hasExtras ? 'text-amber-500' : 'text-muted-foreground/50'}`} />
                        <span className={`text-lg font-bold ${hasExtras ? 'text-amber-700' : 'text-foreground'}`}>
                            {formatCurrency(obra.extras_solicitados_eur || 0)}
                        </span>
                    </div>
                </div>
              </div>

              {/* Action Hint */}
              <div className="flex justify-end pt-2 border-t border-border/50">
                <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Ver Tablero <ArrowRight className="w-3 h-3" />
                </span>
              </div>

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ObrasProcesosList;
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const COLORS = {
  contactado: '#3b82f6', 
  agendada_visita: '#6366f1',
  visitado: '#a855f7',
  en_preparacion: '#f59e0b',
  presupuestado: '#f97316',
  aceptado: '#10b981',
  default: '#94a3b8'
};

const PartesStatusChart = ({ data, onFilterChange }) => {
  const formatLabel = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
  };

  return (
    <Card className="col-span-1 md:col-span-2 shadow-sm border-muted/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
          Estado de Partes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          {data && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                layout="vertical" 
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  width={110}
                  tickFormatter={formatLabel}
                  interval={0}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [value, formatLabel(name)]}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]} 
                  barSize={24}
                  onClick={(entry) => onFilterChange && onFilterChange(entry.name)}
                  className="cursor-pointer"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.name.toLowerCase()] || '#94a3b8'} 
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              No hay datos disponibles
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PartesStatusChart;
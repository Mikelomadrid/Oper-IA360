import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import IconBadge from '@/components/ui/IconBadge';

const ConversionRateCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversionRate = async () => {
      setLoading(true);
      const { data: rpcData, error } = await supabase.rpc('lead_conversion_summary');

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar tasa de conversión',
          description: error.message,
        });
        setData(null);
      } else if (rpcData && rpcData.length > 0) {
        setData(rpcData[0]);
      } else {
        setData(null);
      }
      setLoading(false);
    };

    fetchConversionRate();
    const interval = setInterval(fetchConversionRate, 60000);

    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col justify-center items-center h-full min-h-[120px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const conversionRate = data?.conversion_rate ? parseFloat(data.conversion_rate).toFixed(2) : '0.00';
    const delta = data?.delta_pp ? parseFloat(data.delta_pp) : 0;
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
    const hasData = data && data.total_leads > 0;

    return (
      <>
        <div className="flex justify-between items-start">
            <p className="text-muted-foreground text-sm">Tasa de Conversión</p>
            <IconBadge icon={TrendingUp} className="bg-gradient-to-tr from-amber-500/20 to-orange-500/30" ariaLabel="Tasa de Conversión" />
        </div>

        <div className="mt-auto">
            <h3 className="text-3xl font-bold text-foreground">{hasData ? `${conversionRate}%` : '0%'}</h3>
            <div className="flex items-center gap-2 text-sm mt-1">
            {hasData ? (
              <>
                {trend === 'up' && <ArrowUp className="w-4 h-4 text-success" />}
                {trend === 'down' && <ArrowDown className="w-4 h-4 text-destructive" />}
                <span className={cn(
                  trend === 'up' ? 'text-success' : 'text-destructive',
                  trend === 'neutral' && 'text-muted-foreground',
                  "font-medium"
                )}>
                  {delta.toFixed(2)} pp
                </span>
                <span className="text-muted-foreground">vs mes anterior</span>
              </>
            ) : (
              <span className="text-muted-foreground">Sin datos este mes</span>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="card relative overflow-hidden flex flex-col justify-between h-full min-h-[160px] p-5 rounded-xl shadow-lg border border-border/20 bg-card group"
    >
      <div className={cn(
        "absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 opacity-10 group-hover:opacity-20 transition-opacity duration-300"
      )} />
      {renderContent()}
    </motion.div>
  );
};

export default ConversionRateCard;
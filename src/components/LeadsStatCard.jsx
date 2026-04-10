import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import IconBadge from '@/components/ui/IconBadge';
import { Card, CardContent } from '@/components/ui/card'; // Import Card component for hover effects

const LeadsStatCard = ({ navigate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeadCount = async () => {
      setLoading(true);
      const { data: rpcData, error } = await supabase.rpc('lead_count_summary');

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error al cargar leads',
          description: error.message,
        });
        setData(null);
      } else if (rpcData && rpcData.length > 0) {
        setData(rpcData[0]);
      } else {
        setData({ total_leads: 0, delta_percent: 0 });
      }
      setLoading(false);
    };

    fetchLeadCount();
  }, []);

  const handleClick = () => {
    navigate('/crm/leads');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col justify-center items-center h-full min-h-[120px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const value = data?.total_leads ?? 0;
    const deltaPercent = data?.delta_percent ? parseFloat(data.delta_percent) : 0;
    const trend = deltaPercent > 0 ? 'up' : deltaPercent < 0 ? 'down' : 'neutral';
    const changeText = deltaPercent !== 0 ? `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}%` : '=';
    
    return (
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-muted-foreground">Leads Activos</p>
            <IconBadge icon={Users} className="bg-gradient-to-tr from-primary/20 to-accent/30" ariaLabel="Leads Activos" />
        </div>

        <div className="mt-auto">
            <h3 className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">{value}</h3>
            <div className="flex items-center gap-2 text-sm mt-1">
            {data ? (
              <>
                {trend === 'up' && <ArrowUp className="w-4 h-4 text-success" />}
                {trend === 'down' && <ArrowDown className="w-4 h-4 text-destructive" />}
                <span className={cn(
                  trend === 'up' ? 'text-success' : 'text-destructive',
                  trend === 'neutral' && 'text-muted-foreground',
                  "font-medium"
                )}>
                  {changeText}
                </span>
                <span className="text-muted-foreground">vs mes anterior</span>
              </>
            ) : (
              <span className="text-muted-foreground">Sin variación</span>
            )}
          </div>
        </div>
      </CardContent>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0 }}
      className="h-full min-h-[160px]"
    >
      <Card 
        className="relative overflow-hidden flex flex-col justify-between cursor-pointer h-full group"
        onClick={handleClick}
      >
         <div className={cn(
          "absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent opacity-10 group-hover:opacity-20 transition-opacity duration-300"
        )} />
        {renderContent()}
      </Card>
    </motion.div>
  );
};

export default LeadsStatCard;
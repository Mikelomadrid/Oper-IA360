import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const AlertCard = ({ title, count, icon: Icon, status = "ok", link, onClick }) => {
  const isAlert = status === "alert";

  // Define colors based on status
  const theme = isAlert
    ? {
      border: "border-red-200 hover:border-red-300",
      bg: "bg-white dark:bg-card",
      iconBg: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
      text: "text-red-700 dark:text-red-400",
      shadow: "hover:shadow-red-100 dark:hover:shadow-none",
      indicator: "bg-red-500"
    }
    : {
      border: "border-emerald-200 hover:border-emerald-300",
      bg: "bg-white dark:bg-card",
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
      text: "text-emerald-700 dark:text-emerald-400",
      shadow: "hover:shadow-emerald-100 dark:hover:shadow-none",
      indicator: "bg-emerald-500"
    };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <Card
        className={cn(
          "relative overflow-hidden cursor-pointer transition-all duration-300 group border-2 h-full",
          theme.border,
          theme.bg,
          theme.shadow
        )}
        onClick={onClick}
      >
        <div className={cn("absolute top-0 right-0 w-16 h-16 opacity-10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150", theme.indicator)} />

        <CardContent className="p-2 sm:p-3 flex flex-col h-full justify-between gap-1.5">
          <div className="flex items-start justify-between">
            <div className={cn("p-1.5 rounded-lg transition-colors", theme.iconBg)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className={cn("flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border",
              isAlert ? "text-red-600 border-red-100" : "text-emerald-600 border-emerald-100")}>
              {isAlert ? <AlertCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
              {isAlert ? "Pendiente" : "OK"}
            </div>
          </div>

          <div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight mb-0.5 text-foreground leading-none mt-1">
              {count}
            </div>
            <h3 className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate mt-0.5">
              {title}
            </h3>
          </div>

          <div className="flex items-center text-[9px] sm:text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors mt-0.5">
            {isAlert ? (
              <>Tareas pendientes <ArrowRight className="w-2.5 h-2.5 ml-1 transition-transform group-hover:translate-x-1" /></>
            ) : (
              <span className="text-emerald-600">Buen trabajo!</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AlertCard;
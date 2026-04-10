import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ChartContainer = ({ title, icon: Icon, children, className }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn("h-full cursor-default", className)}
    >
      <Card className="h-full border border-slate-200/60 dark:border-slate-800/60 shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/50 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-800/30 dark:to-transparent">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-6 h-[calc(100%-65px)] flex flex-col justify-center items-center">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ChartContainer;
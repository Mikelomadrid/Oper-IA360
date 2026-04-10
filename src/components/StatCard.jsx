import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import IconBadge from '@/components/ui/IconBadge';

const StatCard = ({ 
    title, 
    value, 
    change, 
    trend, 
    icon: Icon, 
    color, 
    index, 
    tooltipContent, 
    isLoading = false,
    valueColor = 'text-foreground',
    iconColor, 
    iconBg,
    iconAriaLabel = ''
}) => {
    const trendIcon = trend === 'up' ? <TrendingUp className="h-3 w-3 md:h-4 md:w-4" /> : trend === 'down' ? <TrendingDown className="h-3 w-3 md:h-4 md:w-4" /> : null;

    return (
        <motion.div
            className={`card relative overflow-hidden flex flex-col justify-between h-full min-h-[110px] md:min-h-[160px] p-4 md:p-5 rounded-xl shadow-sm border border-border/40 bg-card`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
        >
            {color && <div className={`absolute -top-2 -right-2 md:-top-4 md:-right-4 w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${color} opacity-10 md:opacity-20 blur-lg md:blur-xl`}></div>}
            <div className="flex items-start justify-between z-10 mb-2 md:mb-0">
                <div className="flex items-center gap-1.5 md:gap-2">
                    <p className="text-xs md:text-sm font-medium text-muted-foreground/80 uppercase tracking-wider">{title}</p>
                    {tooltipContent && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground cursor-help opacity-50 hover:opacity-100 transition-opacity" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs text-xs">{tooltipContent}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                 {Icon && (
                    <div className="transform scale-75 md:scale-100 origin-top-right">
                        <IconBadge 
                            icon={Icon}
                            className={iconBg}
                            iconClassName={iconColor}
                            ariaLabel={iconAriaLabel || title}
                        />
                    </div>
                 )}
            </div>
            
            <div className="z-10 mt-auto">
                {isLoading ? (
                    <div className="flex items-center gap-2">
                         <Loader2 className="h-5 w-5 md:h-8 md:w-8 animate-spin text-primary" />
                         <span className="text-xs md:text-sm text-muted-foreground">Cargando...</span>
                    </div>
                ) : (
                    <div className="flex flex-col md:block">
                        <h2 className={cn("text-2xl md:text-3xl font-bold tracking-tight", valueColor)}>{value}</h2>
                        {change && trendIcon && (
                            <div className={`flex items-center text-[10px] md:text-xs mt-1 font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {trendIcon}
                                <span className="ml-1">{change} vs. mes anterior</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default StatCard;
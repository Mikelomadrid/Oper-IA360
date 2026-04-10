import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, PieChart as PieChartIcon, Users, RotateCcw, Filter, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ElegantDonutChart from '@/components/charts/ElegantDonutChart';

// Definición estricta de los 8 estados solicitados con sus colores específicos
const STATUS_CONFIG = [
  { key: 'nuevo', label: 'Nuevo', color: '#9CA3AF' }, // Gray
  { key: 'contactado', label: 'Contactado', color: '#FACC15' }, // Yellow
  { key: 'visita_agendada', label: 'Visita agendada', color: '#3B82F6' }, // Blue
  { key: 'visitado', label: 'Visitado', color: '#A78BFA' }, // Purple
  { key: 'presupuestado', label: 'Presupuestado', color: '#FB923C' }, // Orange
  { key: 'aceptado', label: 'Aceptado', color: '#22C55E' }, // Green
  { key: 'rechazado', label: 'Rechazado', color: '#EF4444' }, // Red
  { key: 'cancelado', label: 'Cancelado', color: '#374151' }, // Dark Gray
];

const ORIGIN_CONFIG = [
  { key: 'WEB', label: 'Web', color: '#3B82F6' },
  { key: 'ADS', label: 'Ads', color: '#8B5CF6' },
  { key: 'REFERIDO', label: 'Referido', color: '#10B981' },
  { key: 'CLIENTE', label: 'Cliente', color: '#F97316' },
  { key: 'AMIGO', label: 'Amigo', color: '#EAB308' },
  { key: 'FAMILIAR', label: 'Familiar', color: '#14B8A6' },
  { key: 'COMPRA', label: 'Compra', color: '#6366F1' },
  { key: 'ATC', label: 'ATC Fincas', color: '#F472B6' }, 
  { key: 'DEL_BRIO', label: 'Del Brio', color: '#9CA3AF' },
  { key: 'GERENCIA', label: 'Gerencia', color: '#D946EF' },
  { key: 'PARTE DE TRABAJO', label: 'Parte de trabajo', color: '#0F172A' },
  { key: 'LOLO', label: 'Lolo', color: '#be123c' }, 
  { key: 'ARACELI_SEO', label: 'Araceli SEO', color: '#FFD700' },
  { key: 'OSCAR_SEO', label: 'Oscar SEO', color: '#C0C0C0' },
];

const LeadConversionChart = ({ onFilterChange }) => {
    const [allLeads, setAllLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState({ type: null, value: null });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch basic fields needed for counting
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, estado, origen');

                if (error) throw error;
                setAllLeads(data || []);
            } catch (error) {
                console.error('Error loading leads data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
        // Listen for changes to update chart in real-time
        const subscription = supabase
            .channel('lead-chart-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchData();
            })
            .subscribe();
            
        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    // --- GLOBAL STATUS DATA ---
    const globalStatusData = useMemo(() => {
        const map = STATUS_CONFIG.reduce((acc, item) => {
            acc[item.key] = 0;
            return acc;
        }, {});

        allLeads.forEach(item => {
            let s = item.estado?.toLowerCase()?.trim();
            if (s === 'convertido' || s === 'aprobado') s = 'aceptado';
            if (s === 'anulado') s = 'cancelado';
            if (map.hasOwnProperty(s)) {
                map[s] += 1;
            }
        });

        const total = allLeads.length;
        
        return STATUS_CONFIG.map(config => ({
            name: config.label,
            value: map[config.key],
            color: config.color,
            percent: total > 0 ? map[config.key] / total : 0
        }));
    }, [allLeads]);

    // --- GLOBAL ORIGIN DATA ---
    const globalOriginData = useMemo(() => {
        const originCounts = {};
        allLeads.forEach(lead => {
            let originKey = lead.origen ? lead.origen.trim().toUpperCase() : 'DESCONOCIDO';
            originCounts[originKey] = (originCounts[originKey] || 0) + 1;
        });

        const total = allLeads.length;

        return Object.keys(originCounts).map(key => {
            const config = ORIGIN_CONFIG.find(c => c.key === key || c.label.toUpperCase() === key) || { label: key, color: '#9CA3AF' };
            const value = originCounts[key];
            return {
                name: config.label,
                key: key,
                value: value,
                color: config.color,
                percent: total > 0 ? value / total : 0
            };
        }).sort((a, b) => b.value - a.value);
    }, [allLeads]);

    // --- LEGEND DATA (Context Sensitive) ---
    const legendData = useMemo(() => {
        if (!activeFilter.type) {
            return { 
                title: 'Resumen global de estados', 
                data: globalStatusData 
            };
        }

        if (activeFilter.type === 'status') {
            const subset = allLeads.filter(lead => {
                let s = lead.estado?.toLowerCase() || '';
                if (s === 'convertido' || s === 'aprobado') s = 'aceptado';
                if (s === 'anulado') s = 'cancelado';
                return s === activeFilter.value.toLowerCase();
            });

            const originCounts = {};
            subset.forEach(lead => {
                const originKey = lead.origen ? lead.origen.trim().toUpperCase() : 'DESCONOCIDO';
                originCounts[originKey] = (originCounts[originKey] || 0) + 1;
            });

            const data = Object.keys(originCounts).map(key => {
                const config = ORIGIN_CONFIG.find(c => c.key === key || c.label.toUpperCase() === key) || { label: key, color: '#9CA3AF' };
                const value = originCounts[key];
                return {
                    name: config.label,
                    value: value,
                    color: config.color,
                    percent: subset.length > 0 ? value / subset.length : 0
                };
            }).sort((a, b) => b.value - a.value);

            const label = STATUS_CONFIG.find(s => s.key === activeFilter.value)?.label || activeFilter.value;
            return { title: `Orígenes para: ${label}`, data };
        }

        if (activeFilter.type === 'origin') {
            const subset = allLeads.filter(lead => {
                let o = lead.origen?.trim().toUpperCase() || 'DESCONOCIDO';
                return o === activeFilter.value.toUpperCase();
            });

            const map = STATUS_CONFIG.reduce((acc, item) => { acc[item.key] = 0; return acc; }, {});
            subset.forEach(item => {
                let s = item.estado?.toLowerCase();
                if (s === 'convertido' || s === 'aprobado') s = 'aceptado';
                if (s === 'anulado') s = 'cancelado';
                if (map.hasOwnProperty(s)) map[s] += 1;
            });

            const total = subset.length;
            const data = STATUS_CONFIG.map(config => ({
                name: config.label,
                value: map[config.key],
                color: config.color,
                percent: total > 0 ? map[config.key] / total : 0
            })); 

            return { title: `Estados para: ${activeFilter.value}`, data };
        }
    }, [activeFilter, allLeads, globalStatusData]);


    // --- HANDLERS ---

    const handleChartClick = (type, data) => {
        let newFilter = null;

        if (type === 'status') {
            const config = STATUS_CONFIG.find(c => c.label === data.name);
            if (config) newFilter = { type: 'status', value: config.key };
        } else if (type === 'origin') {
            const config = ORIGIN_CONFIG.find(c => c.label === data.name) || globalOriginData.find(d => d.name === data.name);
            if (config) {
                // If found in globalOriginData, the key is directly available
                const val = config.key || config.name.toUpperCase();
                newFilter = { type: 'origin', value: val };
            }
        }

        if (newFilter) {
            setActiveFilter(newFilter);
            if (onFilterChange) onFilterChange(newFilter);
        }
    };

    const resetFilter = () => {
        setActiveFilter({ type: null, value: null });
        if (onFilterChange) onFilterChange(null);
    };

    // Filter out 0 values for clean charts
    const chartReadyStatus = useMemo(() => globalStatusData.filter(d => d.value > 0), [globalStatusData]);
    const chartReadyOrigin = useMemo(() => globalOriginData.filter(d => d.value > 0), [globalOriginData]);

    if (loading) return (
        <div className="w-full h-80 flex items-center justify-center bg-card border rounded-xl shadow-sm mb-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6 transition-all duration-300"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b bg-muted/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <PieChartIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            Estadísticas de Leads
                            {activeFilter.type && (
                                <motion.span 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1"
                                >
                                    <Filter className="w-3 h-3" />
                                    {activeFilter.type === 'status' ? 'Estado' : 'Origen'} = {activeFilter.value}
                                </motion.span>
                            )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Análisis de conversión y procedencia de leads. Haz click en los gráficos para filtrar.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <AnimatePresence>
                        {activeFilter.type && (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="overflow-hidden"
                            >
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={resetFilter}
                                    className="h-8 text-muted-foreground hover:text-foreground whitespace-nowrap"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Limpiar Filtro
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    <div className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-full shadow-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{allLeads.length} <span className="text-muted-foreground font-normal">Total</span></span>
                    </div>
                </div>
            </div>

            {/* Content Container (Stacked Layout) */}
            <div className="flex flex-col gap-6 p-4">
                
                {/* CHARTS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Status Chart */}
                    <div className="min-h-[350px]">
                        <ElegantDonutChart 
                            title="Por Estado" 
                            icon={CheckCircle2}
                            data={chartReadyStatus} 
                            centerLabel={{ value: allLeads.length, label: 'Leads' }}
                            showLegend={false}
                            onSectionClick={(data) => handleChartClick('status', data)}
                            height={320}
                        />
                    </div>

                    {/* Origin Chart */}
                    <div className="min-h-[350px]">
                        {chartReadyOrigin.length > 0 ? (
                            <ElegantDonutChart 
                                title="Por Origen" 
                                icon={PieChartIcon}
                                data={chartReadyOrigin} 
                                centerLabel={{ value: allLeads.length, label: 'Origen' }}
                                showLegend={false}
                                onSectionClick={(data) => handleChartClick('origin', data)}
                                height={320}
                            />
                        ) : (
                            <div className="h-[350px] flex items-center justify-center border border-dashed rounded-xl">
                                <div className="text-muted-foreground text-sm italic">Sin datos de origen</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* LEGEND ROW (Grid Layout) - Keeping the custom legend as it provides detailed info */}
                <div className="w-full bg-background/50 rounded-xl border border-border/60 p-4">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
                        <span>{legendData.title}</span>
                        {activeFilter.type && (
                            <motion.span
                                initial={{ opacity: 0, x: 5 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20"
                            >
                                Filtrado
                            </motion.span>
                        )}
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {legendData.data.length > 0 ? (
                            legendData.data.map((item) => {
                                const label = item.name || item.label;
                                
                                return (
                                    <motion.div 
                                        key={label} 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/30 transition-all duration-200 cursor-pointer group bg-card"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                            <div 
                                                className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0" 
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className={cn(
                                                "text-xs font-medium truncate group-hover:text-primary transition-colors",
                                                item.value === 0 ? "text-muted-foreground" : "text-foreground"
                                            )}>
                                                {label}
                                            </span>
                                        </div>
                                        <div className="text-right flex-shrink-0 pl-2">
                                            <span className={cn(
                                                "text-xs font-bold block leading-tight",
                                                item.value === 0 ? "text-muted-foreground" : "text-foreground"
                                            )}>
                                                {item.value}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="col-span-full text-center py-4 text-muted-foreground text-sm italic">
                                No hay datos disponibles para este filtro.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default LeadConversionChart;
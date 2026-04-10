import React, { useMemo, useState } from 'react';
import { format, differenceInDays, addDays, startOfWeek, startOfMonth, max, min } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const ViewMode = {
    Day: 'Day',
    Week: 'Week',
    Month: 'Month',
    Year: 'Year'
};

const CELL_WIDTHS = {
    Day: 45,
    Week: 110,
    Month: 200,
    Year: 300,
};

// Sábados y domingos ocupan solo el 30% del ancho de un día laborable
const WEEKEND_WIDTH_RATIO = 0.3;

export function NativeGantt({
    tasks = [],
    viewMode = ViewMode.Day,
    zoomLevel,
    onDoubleClick,
    onDateChange,
    canManage = true,
    TooltipContent,
    maxHeight = '540px',
    festivosSet = new Set(),
}) {
    const [hoveredTask, setHoveredTask] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [dragState, setDragState] = useState(null);

    const handleMouseMove = (e, task) => {
        if (dragState) return;
        setHoveredTask(task);
        setTooltipPos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseLeave = () => setHoveredTask(null);

    // ─── ¿Es día no laborable? ─────────────────────────────────────────────────
    const esDiaNoLaboral = (date) => {
        const dow = date.getDay();
        if (dow === 0 || dow === 6) return true;
        if (festivosSet.size > 0) {
            const iso = format(date, 'yyyy-MM-dd');
            if (festivosSet.has(iso)) return true;
        }
        return false;
    };

    // 1. Rango de fechas total
    const dateRange = useMemo(() => {
        if (!tasks.length) {
            const today = new Date();
            return { startDate: addDays(today, -3), endDate: addDays(today, 10), totalDays: 14 };
        }
        const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
        if (!dates.length) return null;
        const minDate = addDays(min(dates), -5);
        const maxDate = addDays(max(dates), 10);
        return { startDate: minDate, endDate: maxDate, totalDays: differenceInDays(maxDate, minDate) + 1 };
    }, [tasks]);

    // 2. Generar columnas y offsets acumulados
    const { dates, cellWidth, totalWidth, dayOffsets } = useMemo(() => {
        if (!dateRange) return { dates: [], cellWidth: 0, totalWidth: 0, dayOffsets: [] };

        let cw = CELL_WIDTHS[viewMode] || CELL_WIDTHS.Day;
        if (viewMode === ViewMode.Day && zoomLevel !== undefined) cw = zoomLevel;

        const arr = [];
        let d = new Date(dateRange.startDate);

        if (viewMode === ViewMode.Day) {
            for (let i = 0; i < dateRange.totalDays; i++) {
                arr.push(new Date(d));
                d = addDays(d, 1);
            }
        } else if (viewMode === ViewMode.Week) {
            let current = startOfWeek(d, { weekStartsOn: 1 });
            while (current <= dateRange.endDate) {
                arr.push(new Date(current));
                current = addDays(current, 7);
            }
        } else if (viewMode === ViewMode.Month) {
            let current = startOfMonth(d);
            while (current <= dateRange.endDate) {
                arr.push(new Date(current));
                current = addDays(current, 30);
            }
        }

        // Offsets acumulados por día (solo vista Día)
        const offsets = [];
        let accumulated = 0;
        if (viewMode === ViewMode.Day) {
            for (let i = 0; i < arr.length; i++) {
                offsets.push(accumulated);
                accumulated += esDiaNoLaboral(arr[i]) ? cw * WEEKEND_WIDTH_RATIO : cw;
            }
        }

        const total = viewMode === ViewMode.Day ? accumulated : arr.length * cw;
        return { dates: arr, cellWidth: cw, totalWidth: total, dayOffsets: offsets };
    }, [dateRange, viewMode, zoomLevel, festivosSet]);

    if (!dateRange || !tasks.length) return null;

    // ─── Ancho real de una columna ─────────────────────────────────────────────
    const getDayWidth = (date) => {
        if (viewMode !== ViewMode.Day) return cellWidth;
        return esDiaNoLaboral(date) ? cellWidth * WEEKEND_WIDTH_RATIO : cellWidth;
    };

    // ─── Offset X de una fecha ─────────────────────────────────────────────────
    const getDateOffset = (date) => {
        if (viewMode !== ViewMode.Day) {
            const msInDay = 1000 * 60 * 60 * 24;
            const diff = (new Date(date).getTime() - dateRange.startDate.getTime()) / msInDay;
            if (viewMode === ViewMode.Week) return (diff / 7) * cellWidth;
            if (viewMode === ViewMode.Month) return (diff / 30) * cellWidth;
            return diff * cellWidth;
        }
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const start = new Date(dateRange.startDate);
        start.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 0;
        if (diffDays < dayOffsets.length) return dayOffsets[diffDays];
        let acc = dayOffsets[dayOffsets.length - 1] || 0;
        acc += getDayWidth(dates[dates.length - 1]) * (diffDays - dayOffsets.length + 1);
        return acc;
    };

    // ─── Ancho de una barra entre dos fechas ──────────────────────────────────
    const getBarWidth = (start, end) => {
        if (viewMode !== ViewMode.Day) {
            const msInDay = 1000 * 60 * 60 * 24;
            const duration = Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / msInDay);
            if (viewMode === ViewMode.Week) return (duration / 7) * cellWidth;
            if (viewMode === ViewMode.Month) return (duration / 30) * cellWidth;
            return duration * cellWidth;
        }
        const s = new Date(start); s.setHours(0, 0, 0, 0);
        const e = new Date(end); e.setHours(0, 0, 0, 0);
        let width = 0;
        const cursor = new Date(s);
        while (cursor <= e) {
            width += getDayWidth(cursor);
            cursor.setDate(cursor.getDate() + 1);
        }
        return Math.max(cellWidth * WEEKEND_WIDTH_RATIO, width);
    };

    // ─── ✅ Segmentos laborables de una tarea ──────────────────────────────────
    // Divide la tarea en tramos continuos de días laborables, saltando fines de semana
    const getTaskSegments = (start, end) => {
        if (viewMode !== ViewMode.Day) {
            return [{ start, end }];
        }

        const segments = [];
        let segStart = null;

        const cursor = new Date(start);
        cursor.setHours(12, 0, 0, 0);
        const endD = new Date(end);
        endD.setHours(12, 0, 0, 0);

        while (cursor <= endD) {
            const noLaboral = esDiaNoLaboral(cursor);
            if (!noLaboral) {
                if (!segStart) segStart = new Date(cursor);
            } else {
                if (segStart) {
                    const segEnd = new Date(cursor);
                    segEnd.setDate(segEnd.getDate() - 1);
                    segments.push({ start: new Date(segStart), end: new Date(segEnd) });
                    segStart = null;
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        if (segStart) {
            segments.push({ start: new Date(segStart), end: new Date(endD) });
        }

        return segments.length > 0 ? segments : [{ start, end }];
    };

    // ─── Drag & drop ──────────────────────────────────────────────────────────
    React.useEffect(() => {
        const handleDocMouseMove = (e) => {
            if (!dragState) return;
            e.preventDefault();
            const delta = e.clientX - dragState.startX;
            setDragState(prev => prev ? { ...prev, deltaPx: delta } : null);
        };
        const handleDocMouseUp = () => {
            if (!dragState) return;
            if (dragState.deltaPx !== 0 && Math.abs(dragState.deltaPx) > 5 && onDateChange) {
                let daysToShift = 0;
                if (viewMode === ViewMode.Day) daysToShift = Math.round(dragState.deltaPx / cellWidth);
                else if (viewMode === ViewMode.Week) daysToShift = Math.round((dragState.deltaPx / cellWidth) * 7);
                else if (viewMode === ViewMode.Month) daysToShift = Math.round((dragState.deltaPx / cellWidth) * 30);
                if (daysToShift !== 0) {
                    const newStart = addDays(new Date(dragState.task.start), daysToShift);
                    const newEnd = addDays(new Date(dragState.task.end), daysToShift);
                    onDateChange({ ...dragState.task, start: newStart, end: newEnd }, daysToShift);
                }
            }
            setDragState(null);
        };
        if (dragState) {
            document.addEventListener('mousemove', handleDocMouseMove, { passive: false });
            document.addEventListener('mouseup', handleDocMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleDocMouseMove);
            document.removeEventListener('mouseup', handleDocMouseUp);
        };
    }, [dragState, cellWidth, viewMode, onDateChange]);

    return (
        <div className="relative font-sans bg-white flex flex-col" style={{ overflow: 'visible' }}>
            <div
                className="w-full"
                style={{
                    overflowX: maxHeight === 'none' ? 'visible' : 'auto',
                    overflowY: maxHeight === 'none' ? 'visible' : 'auto',
                    scrollbarWidth: 'auto',
                    scrollbarColor: '#94a3b8 #f1f5f9',
                    maxHeight: maxHeight === 'none' ? undefined : maxHeight
                }}
            >
                <div
                    className="relative flex flex-col select-none min-h-[400px]"
                    style={{ width: `${totalWidth}px` }}
                >
                    {/* Header de fechas */}
                    <div
                        className="flex flex-col bg-white border-b border-slate-200 shadow-sm shrink-0"
                        style={{ position: 'sticky', top: 0, zIndex: 20, height: '60px' }}
                    >
                        <div className="flex bg-slate-50 border-b border-slate-200 h-1/2 items-end px-2">
                            <div className="text-xs font-semibold text-slate-500 pb-1">Meses y Fecha</div>
                        </div>
                        <div className="flex h-1/2 relative">
                            {dates.map((d, i) => {
                                const w = viewMode === ViewMode.Day ? getDayWidth(d) : cellWidth;
                                const left = viewMode === ViewMode.Day ? (dayOffsets[i] || 0) : i * cellWidth;
                                const isNoLaboral = viewMode === ViewMode.Day && esDiaNoLaboral(d);
                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            "absolute h-full flex items-center justify-center border-r border-slate-100/50 text-xs font-medium truncate",
                                            isNoLaboral ? "text-slate-300" : "text-slate-600"
                                        )}
                                        style={{ left: `${left}px`, width: `${w}px` }}
                                    >
                                        {viewMode === ViewMode.Day && (
                                            isNoLaboral
                                                ? <span className="text-[9px]">{format(d, 'dd', { locale: es })}</span>
                                                : format(d, 'E dd', { locale: es })
                                        )}
                                        {viewMode === ViewMode.Week && format(d, 'dd MMM', { locale: es })}
                                        {viewMode === ViewMode.Month && format(d, 'MMMM yyyy', { locale: es })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grid Background */}
                    <div className="absolute top-[60px] left-0 right-0 bottom-0 pointer-events-none flex z-0">
                        {dates.map((d, i) => {
                            const isNoLaboral = viewMode === ViewMode.Day && esDiaNoLaboral(d);
                            const w = viewMode === ViewMode.Day ? getDayWidth(d) : cellWidth;
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-full border-r",
                                        isNoLaboral ? "bg-slate-100/80 border-slate-200" : "border-slate-100"
                                    )}
                                    style={{ width: `${w}px`, minWidth: `${w}px` }}
                                />
                            );
                        })}
                    </div>

                    {/* ✅ Task Rows — dibuja segmentos separados por fin de semana */}
                    <div className="relative pt-4 pb-12 z-10 flex flex-col">
                        {tasks.map((task, idx) => {
                            const color = task.styles?.backgroundColor || task.project_color_hack || '#8b5cf6';
                            const progress = task.progress || 0;
                            const isZero = progress === 0;
                            const isThisDragged = dragState && dragState.task.id === task.id;
                            const segments = getTaskSegments(task.start, task.end);

                            return (
                                <div
                                    key={task.id || idx}
                                    className={cn("relative flex items-center", isThisDragged ? "z-50" : "")}
                                    style={{ height: '48px' }}
                                >
                                    {segments.map((seg, segIdx) => {
                                        const left = getDateOffset(seg.start);
                                        const width = getBarWidth(seg.start, seg.end);
                                        const appliedLeft = isThisDragged ? left + dragState.deltaPx : left;
                                        const isFirst = segIdx === 0;
                                        const isLast = segIdx === segments.length - 1;

                                        return (
                                            <div
                                                key={segIdx}
                                                className={cn(
                                                    "absolute top-1/2 -translate-y-1/2 h-9 transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md",
                                                    isZero ? "bg-white border-2" : "text-white border-2 border-transparent",
                                                    isThisDragged ? "opacity-80 scale-[1.02] shadow-xl ring-2 ring-indigo-500 duration-0" : "",
                                                    canManage && !task.isDisabled ? "active:cursor-grabbing" : "",
                                                    // Redondeo: primero tiene redondeo izquierdo, último tiene redondeo derecho
                                                    isFirst && isLast ? "rounded-md" :
                                                    isFirst ? "rounded-l-md rounded-r-sm" :
                                                    isLast ? "rounded-l-sm rounded-r-md" : "rounded-sm"
                                                )}
                                                style={{
                                                    left: `${appliedLeft}px`,
                                                    width: `${Math.max(4, width)}px`,
                                                    borderColor: color,
                                                    backgroundColor: '#ffffff',
                                                }}
                                                onDoubleClick={() => onDoubleClick && onDoubleClick(task)}
                                                onMouseDown={(e) => {
                                                    if (!canManage || task.isDisabled) return;
                                                    setHoveredTask(null);
                                                    setDragState({ task, startX: e.clientX, deltaPx: 0 });
                                                    e.stopPropagation();
                                                }}
                                                onMouseMove={(e) => handleMouseMove(e, task)}
                                                onMouseLeave={handleMouseLeave}
                                            >
                                                {/* Progress fill */}
                                                {!isZero && (
                                                    <div
                                                        className="absolute top-0 bottom-0 left-0 transition-all rounded-sm opacity-90"
                                                        style={{ width: `${progress}%`, backgroundColor: color }}
                                                    />
                                                )}
                                                {/* Nombre solo en el primer segmento */}
                                                {isFirst && (
                                                    <div className="absolute inset-0 flex items-center px-3 z-10 truncate text-xs font-bold leading-none select-none">
                                                        <span
                                                            style={{ color: '#1e293b' }}
                                                            className="drop-shadow-sm truncate"
                                                        >
                                                            {task.name}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredTask && TooltipContent && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed z-50 pointer-events-none"
                        style={{ left: tooltipPos.x + 15, top: tooltipPos.y + 15 }}
                    >
                        <TooltipContent task={hoveredTask} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default NativeGantt;

const DAY_MS = 24 * 60 * 60 * 1000;
const WORKDAY_SEGMENTS = {
    1: [[8 * 60 + 30, 14 * 60], [15 * 60, 18 * 60]],
    2: [[8 * 60 + 30, 14 * 60], [15 * 60, 18 * 60]],
    3: [[8 * 60 + 30, 14 * 60], [15 * 60, 18 * 60]],
    4: [[8 * 60 + 30, 14 * 60], [15 * 60, 18 * 60]],
    5: [[8 * 60 + 30, 14 * 60 + 30]],
};
const WORKDAY_MINUTES = Object.fromEntries(
    Object.entries(WORKDAY_SEGMENTS).map(([day, segments]) => [
        day,
        segments.reduce((total, [start, end]) => total + end - start, 0),
    ]),
);

export const toLocalDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        const copy = new Date(value);
        copy.setHours(12, 0, 0, 0);
        return copy;
    }
    const raw = String(value).slice(0, 10);
    const [year, month, day] = raw.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const toIsoDate = (value) => {
    const date = toLocalDate(value);
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isWorkingDay = (value, holidays = new Set()) => {
    const date = toLocalDate(value);
    if (!date) return false;
    const day = date.getDay();
    return day !== 0 && day !== 6 && !holidays.has(toIsoDate(date));
};

export const normalizeWorkingDay = (value, holidays = new Set()) => {
    const date = toLocalDate(value) || toLocalDate(new Date());
    while (!isWorkingDay(date, holidays)) date.setDate(date.getDate() + 1);
    return date;
};

export const addWorkingDaysInclusive = (startValue, durationDays, holidays = new Set()) => {
    const date = normalizeWorkingDay(startValue, holidays);
    let remaining = Math.max(1, Number(durationDays) || 1) - 1;
    while (remaining > 0) {
        date.setDate(date.getDate() + 1);
        if (isWorkingDay(date, holidays)) remaining -= 1;
    }
    return date;
};

export const nextWorkingDay = (value, holidays = new Set()) => {
    const date = toLocalDate(value) || toLocalDate(new Date());
    date.setDate(date.getDate() + 1);
    return normalizeWorkingDay(date, holidays);
};

export const countWorkingDaysInclusive = (startValue, endValue, holidays = new Set()) => {
    const start = normalizeWorkingDay(startValue, holidays);
    const end = toLocalDate(endValue) || start;
    if (end < start) return 1;
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (isWorkingDay(cursor, holidays)) count += 1;
        cursor.setTime(cursor.getTime() + DAY_MS);
    }
    return Math.max(1, count);
};

export const countWorkingHoursInclusive = (startValue, endValue, holidays = new Set()) => {
    const start = normalizeWorkingDay(startValue, holidays);
    const end = toLocalDate(endValue) || start;
    if (end < start) return WORKDAY_MINUTES[start.getDay()] / 60 || 8.5;
    let minutes = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (isWorkingDay(cursor, holidays)) minutes += WORKDAY_MINUTES[cursor.getDay()] || 0;
        cursor.setTime(cursor.getTime() + DAY_MS);
    }
    return Math.max(0.5, minutes / 60);
};

export const buildSequentialSchedule = (tasks, durations, holidays = new Set(), firstStart = null) => {
    if (!tasks.length) return {};
    let cursor = normalizeWorkingDay(firstStart || tasks[0].fecha_inicio || new Date(), holidays);
    const schedule = {};

    tasks.forEach((task) => {
        const duration = Math.max(1, Number(durations[task.id]) || 1);
        const end = addWorkingDaysInclusive(cursor, duration, holidays);
        schedule[task.id] = {
            fecha_inicio: toIsoDate(cursor),
            fecha_limite: toIsoDate(end),
            duracion_dias: duration,
        };
        cursor = nextWorkingDay(end, holidays);
    });

    return schedule;
};

const laterDate = (...values) => values
    .map((value) => toLocalDate(value))
    .filter(Boolean)
    .reduce((latest, value) => (!latest || value > latest ? value : latest), null);

/**
 * Planifica en orden de ejecucion, pero permite paralelismo real por equipos.
 * Una fila posterior nunca empieza antes que la anterior, aunque puede empezar
 * el mismo dia si sus trabajadores estan disponibles. Las tareas sin equipo se
 * encadenan entre si para no prometer una capacidad que todavia no existe.
 */
export const buildTeamSchedule = (
    tasks,
    durations,
    assignments,
    holidays = new Set(),
    firstStart = null,
    preferredStarts = {},
) => {
    if (!tasks.length) return {};

    const schedule = {};
    const resourceReady = new Map();
    const planStart = normalizeWorkingDay(firstStart || tasks[0].fecha_inicio || new Date(), holidays);
    let orderFloor = planStart;

    tasks.forEach((task) => {
        const employeeIds = [...new Set((assignments[task.id] || []).filter(Boolean))];
        const resourceIds = employeeIds.length > 0 ? employeeIds : ['__sin_equipo__'];
        const resourceDates = resourceIds.map((resourceId) => resourceReady.get(resourceId)).filter(Boolean);
        const preferredStart = preferredStarts[task.id]
            ? normalizeWorkingDay(preferredStarts[task.id], holidays)
            : null;
        const start = normalizeWorkingDay(
            laterDate(orderFloor, preferredStart, ...resourceDates) || planStart,
            holidays,
        );
        const duration = Math.max(1, Number(durations[task.id]) || 1);
        const end = addWorkingDaysInclusive(start, duration, holidays);

        schedule[task.id] = {
            fecha_inicio: toIsoDate(start),
            fecha_limite: toIsoDate(end),
            duracion_dias: duration,
            en_paralelo: false,
        };

        const readyAgain = nextWorkingDay(end, holidays);
        resourceIds.forEach((resourceId) => resourceReady.set(resourceId, readyAgain));
        // El orden de las filas es el orden operativo. Permitimos el mismo dia,
        // pero nunca que una fila posterior se adelante a una anterior.
        orderFloor = start;
    });

    const tasksByStart = Object.values(schedule).reduce((counts, item) => ({
        ...counts,
        [item.fecha_inicio]: (counts[item.fecha_inicio] || 0) + 1,
    }), {});
    Object.values(schedule).forEach((item) => {
        item.en_paralelo = tasksByStart[item.fecha_inicio] > 1;
    });

    return schedule;
};

export const getScheduleBounds = (schedule) => {
    const rows = Object.values(schedule).filter((item) => item.fecha_inicio && item.fecha_limite);
    if (!rows.length) return { start: null, end: null };
    return {
        start: rows.map((item) => item.fecha_inicio).sort()[0],
        end: rows.map((item) => item.fecha_limite).sort().at(-1),
    };
};

const atDayMinute = (value, minutes) => {
    const date = toLocalDate(value) || toLocalDate(new Date());
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date;
};

const atWorkdayStart = (value) => {
    const date = toLocalDate(value) || toLocalDate(new Date());
    const firstSegment = WORKDAY_SEGMENTS[date.getDay()]?.[0];
    return atDayMinute(date, firstSegment?.[0] ?? 8 * 60 + 30);
};

const workSegmentsFor = (value, holidays = new Set()) => {
    const date = toLocalDate(value);
    if (!date || holidays.has(toIsoDate(date))) return [];
    return (WORKDAY_SEGMENTS[date.getDay()] || []).map(([start, end]) => ({
        start: atDayMinute(date, start),
        end: atDayMinute(date, end),
    }));
};

export const normalizeWorkInstant = (value, holidays = new Set()) => {
    let date;
    if (value instanceof Date) date = new Date(value);
    else if (value && String(value).includes('T')) date = new Date(value);
    else date = atWorkdayStart(value || new Date());

    if (Number.isNaN(date.getTime())) date = atWorkdayStart(new Date());

    while (!isWorkingDay(date, holidays)) {
        date = nextWorkingDay(date, holidays);
        date = atWorkdayStart(date);
    }

    const segments = workSegmentsFor(date, holidays);
    for (const segment of segments) {
        if (date < segment.start) return segment.start;
        if (date >= segment.start && date < segment.end) return date;
    }

    return atWorkdayStart(nextWorkingDay(date, holidays));
};

export const addWorkingMinutes = (startValue, minutes, holidays = new Set()) => {
    let cursor = normalizeWorkInstant(startValue, holidays);
    let remaining = Math.max(30, Math.round((Number(minutes) || 30) / 30) * 30);

    while (remaining > 0) {
        const segment = workSegmentsFor(cursor, holidays).find(({ start, end }) => (
            cursor >= start && cursor < end
        ));
        if (!segment) {
            cursor = normalizeWorkInstant(cursor, holidays);
            continue;
        }
        const available = Math.max(0, Math.round((segment.end - cursor) / 60000));
        const consumed = Math.min(remaining, available);
        cursor = new Date(cursor.getTime() + consumed * 60 * 1000);
        remaining -= consumed;

        if (remaining > 0) {
            cursor = normalizeWorkInstant(cursor, holidays);
        }
    }

    return cursor;
};

const instantIso = (value) => new Date(value).toISOString();

/**
 * Agenda las tareas en franjas de 30 minutos. El orden vertical sigue siendo
 * el orden operativo, pero equipos distintos pueden trabajar simultaneamente.
 */
export const buildTeamHourlySchedule = (
    tasks,
    durationHours,
    assignments,
    holidays = new Set(),
    firstStart = null,
    preferredStarts = {},
) => {
    if (!tasks.length) return {};

    const schedule = {};
    const resourceReady = new Map();
    const planStart = normalizeWorkInstant(firstStart || tasks[0].inicio_planificado_at || tasks[0].fecha_inicio || new Date(), holidays);
    let orderFloor = planStart;

    tasks.forEach((task) => {
        const employeeIds = [...new Set((assignments[task.id] || []).filter(Boolean))];
        const resourceIds = employeeIds.length > 0 ? employeeIds : ['__sin_equipo__'];
        const candidates = [orderFloor, ...resourceIds.map((id) => resourceReady.get(id)).filter(Boolean)];
        if (preferredStarts[task.id]) candidates.push(normalizeWorkInstant(preferredStarts[task.id], holidays));
        const start = normalizeWorkInstant(new Date(Math.max(...candidates.map((value) => new Date(value).getTime()))), holidays);
        const hours = Math.max(0.5, Math.round((Number(durationHours[task.id]) || 0.5) * 2) / 2);
        const end = addWorkingMinutes(start, hours * 60, holidays);

        schedule[task.id] = {
            fecha_inicio: toIsoDate(start),
            fecha_limite: toIsoDate(end),
            inicio_planificado_at: instantIso(start),
            fin_planificado_at: instantIso(end),
            duracion_planificada_horas: hours,
            en_paralelo: false,
        };

        resourceIds.forEach((resourceId) => resourceReady.set(resourceId, end));
        orderFloor = start;
    });

    const rows = Object.values(schedule);
    rows.forEach((row) => {
        const rowStart = new Date(row.inicio_planificado_at).getTime();
        const rowEnd = new Date(row.fin_planificado_at).getTime();
        row.en_paralelo = rows.some((other) => (
            other !== row
            && rowStart < new Date(other.fin_planificado_at).getTime()
            && rowEnd > new Date(other.inicio_planificado_at).getTime()
        ));
    });

    return schedule;
};

export const formatScheduleTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const getHourlyScheduleBounds = (schedule) => {
    const rows = Object.values(schedule).filter((item) => item.inicio_planificado_at && item.fin_planificado_at);
    if (!rows.length) return { start: null, end: null };
    return {
        start: rows.map((item) => item.inicio_planificado_at).sort()[0],
        end: rows.map((item) => item.fin_planificado_at).sort().at(-1),
    };
};

export const cascadeScheduleFromTask = (tasks, changedTaskId, changedStart, changedEnd, holidays = new Set()) => {
    const changedIndex = tasks.findIndex((task) => task.id === changedTaskId);
    if (changedIndex < 0) return {};

    const schedule = {};
    const previousTask = changedIndex > 0 ? tasks[changedIndex - 1] : null;
    const earliestStart = previousTask?.fecha_limite
        ? nextWorkingDay(previousTask.fecha_limite, holidays)
        : normalizeWorkingDay(changedStart, holidays);
    let cursor = normalizeWorkingDay(changedStart, holidays);
    if (cursor < earliestStart) cursor = earliestStart;

    const changedDuration = countWorkingDaysInclusive(changedStart, changedEnd, holidays);
    let end = addWorkingDaysInclusive(cursor, changedDuration, holidays);
    schedule[changedTaskId] = {
        fecha_inicio: toIsoDate(cursor),
        fecha_limite: toIsoDate(end),
        duracion_dias: changedDuration,
    };

    cursor = nextWorkingDay(end, holidays);
    tasks.slice(changedIndex + 1).forEach((task) => {
        const duration = countWorkingDaysInclusive(task.fecha_inicio, task.fecha_limite, holidays);
        end = addWorkingDaysInclusive(cursor, duration, holidays);
        schedule[task.id] = {
            fecha_inicio: toIsoDate(cursor),
            fecha_limite: toIsoDate(end),
            duracion_dias: duration,
        };
        cursor = nextWorkingDay(end, holidays);
    });

    return schedule;
};

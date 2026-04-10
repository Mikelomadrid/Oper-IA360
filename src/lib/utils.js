import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

export const formatDate = (date) => {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

export function fmtMadrid(dateStr, formatType = 'full') {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  
  if (isNaN(d.getTime())) return 'Fecha inválida';

  // Opciones base para zona horaria Madrid
  const options = { timeZone: 'Europe/Madrid' };

  if (formatType === 'time') {
      return new Intl.DateTimeFormat('es-ES', {
          ...options,
          hour: '2-digit',
          minute: '2-digit'
      }).format(d);
  } else if (formatType === 'date') {
      return new Intl.DateTimeFormat('es-ES', {
          ...options,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
      }).format(d);
  } else {
      return new Intl.DateTimeFormat('es-ES', {
          ...options,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      }).format(d);
  }
}

export const formatSecondsToHoursMinutes = (seconds) => {
  if (!seconds) return "0h 0m"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export const getMadridLocalTime = () => {
    return new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" });
}

// --- New Exports added to fix missing imports ---

export const safeFormat = (date, options) => {
  if (!date) return 'N/A';
  try {
    return new Intl.DateTimeFormat('es-ES', options).format(new Date(date));
  } catch (e) {
    return 'Fecha inválida';
  }
};

export const formatDecimalHoursToHoursMinutes = (decimalHours) => {
  if (!decimalHours && decimalHours !== 0) return "0h 0m";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  // Handle edge case where minutes round up to 60
  if (minutes === 60) return `${hours + 1}h 0m`;
  return `${hours}h ${minutes}m`;
};

export const calculateWeeklySummary = (data) => {
  // TODO: Implement this function properly based on data structure
  return { total: 0, days: [] };
};

export const sanitizeKey = (key) => {
  if (!key) return '';
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '_');
};

export const normalizeSupabaseDate = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr);
};

export const convertDecimalHoursToDisplay = (hours) => {
    return formatDecimalHoursToHoursMinutes(hours);
};

export const isAdminOrEncargado = (user) => {
  if (!user) return false;
  const role = user.rol || user.role;
  return ['admin', 'encargado'].includes(role);
};

export const isTechnician = (user) => {
  if (!user) return false;
  const role = user.rol || user.role;
  return role === 'tecnico';
};

export const canManageOrOwn = (user, resourceOwnerId) => {
  if (!user) return false;
  if (isAdminOrEncargado(user)) return true;
  return user.id === resourceOwnerId || user.auth_user_id === resourceOwnerId;
};

export const getGreetingByHour = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

export const parseMadridToUTC = (dateStr) => {
    // Basic implementation - relies on browser parsing for now
    return new Date(dateStr);
};

export const calculateFichajeDuration = (entry, exit) => {
    if (!entry || !exit) return 0;
    const start = new Date(entry).getTime();
    const end = new Date(exit).getTime();
    return (end - start) / 1000; // seconds
};

// --- NEW UTILITIES FOR OVERTIME & TIMEZONE ---

/**
 * Converts any date input to a string time (HH:mm) in Europe/Madrid timezone.
 * Handles UTC strings, ISO strings, and Date objects.
 */
export const toMadridTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (err) {
    console.error("Error formatting Madrid time:", err);
    return '-';
  }
};

/**
 * Calculates overtime based on the 8.5 hour threshold logic.
 * Logic: 8 hours base + 30 min courtesy. Overtime counts only AFTER 8h 30m.
 * Result is total_hours - 8.5 (if positive).
 * @param {number} totalHours - Total worked hours in decimal
 * @returns {object} { normal: number, extra: number }
 */
export const calculateOvertimeThreshold = (totalHours) => {
    const threshold = 8.5; // 8h 30m
    const total = Number(totalHours) || 0;
    
    if (total <= threshold) {
        return { normal: total, extra: 0 };
    }
    
    return {
        normal: threshold,
        extra: total - threshold
    };
};
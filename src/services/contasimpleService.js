// Acceso seguro a Contasimple: siempre a través del proyecto Supabase activo.
import { supabase } from '@/lib/customSupabaseClient';

const FUNCTION_NAME = 'contasimple-readonly';
const READ_ONLY_ACTIONS = new Set(['test', 'invoices', 'expenses', 'summary', 'estimates', 'products']);

async function callContasimple(payload) {
  if (!READ_ONLY_ACTIONS.has(payload?.action)) {
    throw new Error('Operación bloqueada: Contasimple está configurado en modo solo lectura.');
  }

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: payload });
  if (error) throw new Error(error.message || 'No se pudo consultar Contasimple.');
  if (data?.ok === false) throw new Error(data.message || 'Contasimple devolvió un error.');
  return data;
}

export async function testConnection() {
  return callContasimple({ action: 'test' });
}

export async function getFacturasEmitidas(fromDate = '2025-01-01') {
  return callContasimple({ action: 'invoices', fromDate });
}

export async function getFacturasRecibidas(fromDate = '2025-01-01') {
  return callContasimple({ action: 'expenses', fromDate });
}

export async function getResumenFinanciero(fromDate = '2025-01-01') {
  return callContasimple({ action: 'summary', fromDate });
}

export async function getPresupuestos(fromDate = '2025-01-01') {
  return callContasimple({ action: 'estimates', fromDate });
}

export async function getProductos() {
  return callContasimple({ action: 'products' });
}

export async function crearFacturaEmitida() {
  throw new Error('Operación bloqueada: no se permite crear facturas en Contasimple desde el ERP.');
}

export async function crearGasto() {
  throw new Error('Operación bloqueada: no se permite crear gastos en Contasimple desde el ERP.');
}

export const formatters = {
  currency: (amount) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0),
  date: (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  status: (status) => {
    const map = {
      'Pending': { label: 'PENDIENTE', color: 'yellow' },
      'Paid': { label: 'PAGADA', color: 'green' },
      'Overdue': { label: 'VENCIDA', color: 'red' },
      'Draft': { label: 'BORRADOR', color: 'gray' },
    };
    return map[status] || { label: status, color: 'gray' };
  },
};

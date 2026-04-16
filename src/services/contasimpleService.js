// contasimpleService.js
const EDGE_FUNCTION_URL = 'https://dkkiomutzyvscnqqchqs.supabase.co/functions/v1/swift-function';

async function callContasimple(payload) {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRra2lvbXV0enl2c2NucXFjaHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTkxNjQsImV4cCI6MjA3NjAzNTE2NH0.oZCxYbVoRYFhU7RCm1XR4cRsQ92E1tj78HtqFRuag6g',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error llamando a Contasimple:', error);
    throw error;
  }
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

export async function crearFacturaEmitida(invoiceData) {
  return callContasimple({ action: 'create_invoice', invoiceData });
}

export async function crearGasto(expenseData) {
  return callContasimple({ action: 'create_expense', expenseData });
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
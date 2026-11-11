import { supabase } from '@/lib/customSupabaseClient';

const PAGE_SIZE = 1000;

/**
 * Devuelve el coste de materiales por obra usando exclusivamente la base
 * imponible guardada en gastos.monto_bruto. Los abonos se respetan porque
 * llegan con importe negativo.
 */
export const fetchProjectMaterialBaseTotals = async (projectIds = []) => {
  const ids = [...new Set(projectIds.filter(Boolean).map(String))];
  const totals = Object.fromEntries(ids.map((id) => [id, 0]));

  if (ids.length === 0) return totals;

  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('gastos')
      .select('id, proyecto_id, monto_bruto')
      .in('proyecto_id', ids)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    for (const gasto of data || []) {
      const projectId = String(gasto.proyecto_id);
      totals[projectId] = (totals[projectId] || 0) + Number(gasto.monto_bruto || 0);
    }

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return totals;
};

export const fetchProjectMaterialBaseTotal = async (projectId) => {
  if (!projectId) return 0;
  const totals = await fetchProjectMaterialBaseTotals([projectId]);
  return totals[String(projectId)] || 0;
};

/**
 * Devuelve el coste neto real imputado a cada obra.
 * Incluye compras y salidas de almacén y descuenta devoluciones.
 */
export const fetchProjectMaterialNetTotals = async (projectIds = []) => {
  const ids = [...new Set(projectIds.filter(Boolean).map(String))];
  const totals = Object.fromEntries(ids.map((id) => [id, 0]));

  if (ids.length === 0) return totals;

  const { data, error } = await supabase
    .from('v_obra_materiales_balance')
    .select('obra_id, coste_neto')
    .in('obra_id', ids);

  // Algunas instalaciones antiguas todavía no tienen creada esta vista.
  // Usamos los gastos imputados como respaldo para no bloquear la carga
  // completa de proyectos por el cálculo opcional de materiales.
  if (error) {
    console.warn('[projectMaterialCosts] Vista de balance no disponible; usando gastos:', error.message || error);
    return fetchProjectMaterialBaseTotals(ids);
  }

  for (const row of data || []) {
    const projectId = String(row.obra_id);
    totals[projectId] = (totals[projectId] || 0) + Number(row.coste_neto || 0);
  }

  return totals;
};

export const fetchProjectMaterialNetTotal = async (projectId) => {
  if (!projectId) return 0;
  const totals = await fetchProjectMaterialNetTotals([projectId]);
  return totals[String(projectId)] || 0;
};

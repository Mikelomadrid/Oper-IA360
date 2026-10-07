-- IA360: permiso base necesario para que PostgREST pueda consultar gastos.
-- Aplicar exclusivamente en desarrollo-seguro (obigqojehfxxgfluygdg).
-- Las filas visibles siguen limitadas por las politicas RLS de public.gastos.

grant select on table public.gastos to authenticated;

select has_table_privilege(
  'authenticated',
  'public.gastos',
  'SELECT'
) as lectura_gastos_autenticados;

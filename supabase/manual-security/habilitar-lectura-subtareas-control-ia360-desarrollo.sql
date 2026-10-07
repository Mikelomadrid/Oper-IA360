-- IA360: permiso base necesario para consultar subtareas desde el detalle enfocado.
-- Aplicar exclusivamente en desarrollo-seguro (obigqojehfxxgfluygdg).
-- Las filas visibles siguen limitadas por las politicas RLS de public.subtareas.

grant select on table public.subtareas to authenticated;

select
  has_table_privilege(
    'authenticated',
    'public.subtareas',
    'SELECT'
  ) as lectura_subtareas_autenticados,
  c.relrowsecurity as rls_activo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'subtareas';

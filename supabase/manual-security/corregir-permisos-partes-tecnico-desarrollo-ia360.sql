-- Ejecutar exclusivamente en el proyecto Supabase de desarrollo:
-- obigqojehfxxgfluygdg (desarrollo-seguro)
--
-- Objetivo:
-- 1. Permitir que authenticated use la vista de partes.
-- 2. Hacer que la vista respete las políticas RLS de public.partes.
-- 3. Permitir que cada usuario consulte y actualice sus propias marcas de avisos.

begin;

alter view public.v_partes_estado_ui
  set (security_invoker = true);

grant select
  on table public.v_partes_estado_ui
  to authenticated;

grant select, insert, update
  on table public.usuario_alertas_vistas
  to authenticated;

commit;

-- Verificación. Debe devolver dos filas con todos los permisos necesarios a true.
select
  c.relname,
  c.reloptions,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT') as can_select,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'INSERT') as can_insert,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE') as can_update
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('v_partes_estado_ui', 'usuario_alertas_vistas')
order by c.relname;

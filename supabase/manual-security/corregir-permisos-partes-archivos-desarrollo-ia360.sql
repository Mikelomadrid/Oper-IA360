-- Ejecutar exclusivamente en:
-- obigqojehfxxgfluygdg (desarrollo-seguro)
--
-- Las políticas RLS de public.partes_archivos ya limitan cada operación al
-- usuario y al parte relacionado. Estos privilegios permiten que dichas
-- políticas puedan evaluarse desde el ERP.

begin;

grant select, insert, delete
  on table public.partes_archivos
  to authenticated;

commit;

select
  has_table_privilege('authenticated', 'public.partes_archivos', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.partes_archivos', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.partes_archivos', 'DELETE') as can_delete;

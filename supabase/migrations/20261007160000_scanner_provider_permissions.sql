-- Permisos base para que administradores y encargados puedan usar el selector
-- y crear proveedores desde el escáner. Las políticas RLS existentes siguen
-- limitando las filas a app_is_admin_or_encargado().

begin;

grant select, insert, update on table public.proveedores to authenticated;

commit;

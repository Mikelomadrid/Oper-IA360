-- Categoría laboral del empleado, independiente del rol de permisos de la aplicación.
alter table public.empleados
  add column if not exists categoria text;

comment on column public.empleados.categoria is
  'Categoría laboral o profesional del empleado; no debe confundirse con el rol de acceso a la aplicación.';

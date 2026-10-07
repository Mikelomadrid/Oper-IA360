begin;

-- Las vistas de auditoria se ejecutan con los permisos del usuario y necesitan
-- SELECT en sus tablas base. RLS mantiene el acceso limitado a los perfiles
-- que ya pueden gestionar la obra.
grant select on table public.partidas_gasto to authenticated;

alter table public.facturas_gastos_lineas_ocr enable row level security;
grant select on table public.facturas_gastos_lineas_ocr to authenticated;

drop policy if exists facturas_gastos_lineas_ocr_gestion_select
  on public.facturas_gastos_lineas_ocr;

create policy facturas_gastos_lineas_ocr_gestion_select
on public.facturas_gastos_lineas_ocr
for select
to authenticated
using (public.is_admin_or_encargado());

alter table public.facturas_gastos_ocr enable row level security;
grant select on table public.facturas_gastos_ocr to authenticated;

drop policy if exists facturas_gastos_ocr_gestion_select
  on public.facturas_gastos_ocr;

create policy facturas_gastos_ocr_gestion_select
on public.facturas_gastos_ocr
for select
to authenticated
using (public.is_admin_or_encargado());

commit;

begin;

-- La vista de materiales enlaza cada gasto con su factura OCR para mostrar
-- el documento original. La tabla no concedia SELECT al rol authenticated.
-- Se activa RLS antes de concederlo para evitar exponer facturas a usuarios
-- que no sean responsables de gestion.
alter table public.facturas_gastos enable row level security;

grant select on table public.facturas_gastos to authenticated;

drop policy if exists facturas_gastos_gestion_select
  on public.facturas_gastos;

create policy facturas_gastos_gestion_select
on public.facturas_gastos
for select
to authenticated
using (public.is_admin_or_encargado());

commit;

-- Permite que el circuito financiero consulte y gestione los gastos generales.
grant select, insert, update, delete on public.gastos_generales to authenticated, service_role;

alter table public.gastos_generales enable row level security;

drop policy if exists gastos_generales_gestion on public.gastos_generales;
create policy gastos_generales_gestion
on public.gastos_generales
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

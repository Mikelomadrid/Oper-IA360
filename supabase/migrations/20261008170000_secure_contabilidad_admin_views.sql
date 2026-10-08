begin;

-- Centraliza la autorización contable sin exponer los datos a cualquier
-- usuario autenticado. La función usa el UID del JWT y solo admite empleados
-- administradores activos.
create or replace function public.erp_puede_ver_contabilidad()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.empleados e
    where e.auth_user_id = auth.uid()
      and e.rol = 'admin'
      and e.activo is true
      and coalesce(e.baja, false) is false
  );
$$;

revoke all on function public.erp_puede_ver_contabilidad() from public;
revoke all on function public.erp_puede_ver_contabilidad() from anon;
grant execute on function public.erp_puede_ver_contabilidad() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contasimple_facturas_emitidas'
      and policyname = 'erp_admin_contabilidad_select'
  ) then
    create policy erp_admin_contabilidad_select
      on public.contasimple_facturas_emitidas
      for select to authenticated
      using (public.erp_puede_ver_contabilidad());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contasimple_facturas_recibidas'
      and policyname = 'erp_admin_contabilidad_select'
  ) then
    create policy erp_admin_contabilidad_select
      on public.contasimple_facturas_recibidas
      for select to authenticated
      using (public.erp_puede_ver_contabilidad());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'contasimple_gastos'
      and policyname = 'erp_admin_contabilidad_select'
  ) then
    create policy erp_admin_contabilidad_select
      on public.contasimple_gastos
      for select to authenticated
      using (public.erp_puede_ver_contabilidad());
  end if;
end $$;

grant select on public.contasimple_facturas_emitidas to authenticated;
grant select on public.contasimple_facturas_recibidas to authenticated;
grant select on public.contasimple_gastos to authenticated;

alter view public.v_contasimple_facturas_emitidas_listado
  set (security_invoker = true);
alter view public.v_contasimple_facturas_recibidas_listado
  set (security_invoker = true);
alter view public.v_contasimple_gastos_listado
  set (security_invoker = true);
alter view public.v_contasimple_dashboard_anual
  set (security_invoker = true);

grant select on public.v_contasimple_facturas_emitidas_listado to authenticated;
grant select on public.v_contasimple_facturas_recibidas_listado to authenticated;
grant select on public.v_contasimple_gastos_listado to authenticated;
grant select on public.v_contasimple_dashboard_anual to authenticated;

commit;

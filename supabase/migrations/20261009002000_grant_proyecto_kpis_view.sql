begin;

grant select on public.v_proyecto_kpis_con_estado to authenticated, service_role;

comment on view public.v_proyecto_kpis_con_estado is
  'KPIs y estado de proyectos visibles para usuarios autenticados del ERP.';

commit;

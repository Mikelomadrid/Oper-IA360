-- Permite que los usuarios autenticados consulten todas las vistas del módulo
-- ERP vs Contasimple. Solo concede SELECT; no habilita escrituras.
do $$
declare
  vista record;
begin
  for vista in
    select schemaname, viewname
    from pg_views
    where schemaname = 'public'
      and viewname like 'v_contasimple%'
  loop
    execute format(
      'grant select on table %I.%I to authenticated',
      vista.schemaname,
      vista.viewname
    );
  end loop;
end
$$;

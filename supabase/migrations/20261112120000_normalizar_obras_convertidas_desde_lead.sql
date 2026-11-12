-- Las obras creadas desde un lead se muestran con el nombre comercial del lead
-- y quedan pendientes hasta su fecha prevista de inicio.

create or replace function public.trg_normalizar_obra_convertida_desde_lead()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nombre text;
begin
  if new.lead_id is null then
    return new;
  end if;

  select coalesce(
    nullif(btrim(nombre_empresa), ''),
    nullif(btrim(nombre_contacto), ''),
    'Sin nombre'
  )
  into v_nombre
  from public.leads
  where id = new.lead_id;

  if v_nombre is not null then
    new.nombre_proyecto := v_nombre;
  end if;

  new.estado := 'en_espera'::public.project_status;
  return new;
end;
$$;

revoke all on function public.trg_normalizar_obra_convertida_desde_lead() from public;
grant execute on function public.trg_normalizar_obra_convertida_desde_lead() to authenticated, service_role;

drop trigger if exists trg_normalizar_obra_convertida_desde_lead on public.proyectos;

create trigger trg_normalizar_obra_convertida_desde_lead
before insert on public.proyectos
for each row
execute function public.trg_normalizar_obra_convertida_desde_lead();

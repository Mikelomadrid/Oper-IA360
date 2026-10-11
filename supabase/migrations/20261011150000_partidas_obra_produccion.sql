-- Vincula cada medicion de produccion con la partida contractual exacta de la obra.
-- El sistema de rendimiento sigue aportando unidades y costes de referencia.

alter table public.obra_sistema_mediciones
  add column if not exists obra_partida_id uuid
    references public.obras_partidas(id) on delete restrict;

create index if not exists obra_sistema_mediciones_partida_fecha_idx
  on public.obra_sistema_mediciones (obra_id, obra_partida_id, fecha desc)
  where obra_partida_id is not null;

create or replace function public.validar_medicion_partida_obra()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_partida public.obras_partidas%rowtype;
begin
  if new.obra_partida_id is null then
    return new;
  end if;

  select * into v_partida
  from public.obras_partidas
  where id = new.obra_partida_id;

  if not found then
    raise exception 'La partida seleccionada no existe.';
  end if;

  if v_partida.obra_id is distinct from new.obra_id then
    raise exception 'La partida seleccionada no pertenece a esta obra.';
  end if;

  if v_partida.sistema_id is null then
    raise exception 'La partida no esta vinculada a la biblioteca de rendimientos.';
  end if;

  if new.sistema_id is distinct from v_partida.sistema_id then
    raise exception 'La medicion no coincide con el sistema de rendimiento de la partida.';
  end if;

  return new;
end;
$$;

drop trigger if exists obra_sistema_mediciones_validar_partida
  on public.obra_sistema_mediciones;
create trigger obra_sistema_mediciones_validar_partida
before insert or update of obra_id, obra_partida_id, sistema_id
on public.obra_sistema_mediciones
for each row execute function public.validar_medicion_partida_obra();

comment on column public.obra_sistema_mediciones.obra_partida_id is
  'Partida contractual concreta de la obra sobre la que se registra la produccion.';

-- La tabla historica tenia RLS por rol, pero no privilegio SQL para usuarios
-- autenticados. El grant permite consultar las partidas sin saltarse la RLS.
grant select on public.obras_partidas to authenticated, service_role;

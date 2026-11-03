-- Mantiene materiales.stock_actual sincronizado con las entradas de albarán.
-- Las funciones modernas de factura/obra ya actualizan stock explícitamente;
-- este trigger cubre únicamente el tipo legado entrada_albaran.
create or replace function public.ia360_sync_entrada_albaran_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.tipo = 'entrada_albaran' then
    update public.materiales
    set stock_actual = coalesce(stock_actual, 0) + new.cantidad
    where id = new.material_id;
  elsif tg_op = 'DELETE' and old.tipo = 'entrada_albaran' then
    update public.materiales
    set stock_actual = coalesce(stock_actual, 0) - old.cantidad
    where id = old.material_id;
  elsif tg_op = 'UPDATE' then
    if old.tipo = 'entrada_albaran' then
      update public.materiales
      set stock_actual = coalesce(stock_actual, 0) - old.cantidad
      where id = old.material_id;
    end if;
    if new.tipo = 'entrada_albaran' then
      update public.materiales
      set stock_actual = coalesce(stock_actual, 0) + new.cantidad
      where id = new.material_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_entrada_albaran_stock
  on public.almacen_material_movimientos;

create trigger trg_sync_entrada_albaran_stock
after insert or update or delete on public.almacen_material_movimientos
for each row execute function public.ia360_sync_entrada_albaran_stock();

revoke all on function public.ia360_sync_entrada_albaran_stock() from public, anon;
grant execute on function public.ia360_sync_entrada_albaran_stock() to authenticated, service_role;

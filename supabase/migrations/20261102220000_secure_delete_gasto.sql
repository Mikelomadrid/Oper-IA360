create or replace function public.admin_eliminar_gasto(p_gasto_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para eliminar gastos.';
  end if;

  update public.detalles_solicitud
  set gasto_id = null
  where gasto_id = p_gasto_id;

  delete from public.gastos
  where id = p_gasto_id;

  if not found then
    raise exception 'El gasto no existe.';
  end if;
end;
$$;

revoke all on function public.admin_eliminar_gasto(uuid) from public;
grant execute on function public.admin_eliminar_gasto(uuid) to authenticated;

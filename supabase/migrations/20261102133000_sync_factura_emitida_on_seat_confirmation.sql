create or replace function public.contabilidad_confirmar_asiento(p_asiento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_asiento public.contabilidad_asientos%rowtype;
  v_lineas integer;
  v_debe numeric(14,2);
  v_haber numeric(14,2);
  v_cuentas_invalidas integer;
begin
  if auth.uid() is null or not public.app_is_admin_or_encargado() then
    raise exception 'No tienes permiso para confirmar asientos.';
  end if;

  select * into v_asiento
  from public.contabilidad_asientos
  where id = p_asiento_id
  for update;

  if not found then
    raise exception 'No se encontró el asiento indicado.';
  end if;
  if v_asiento.estado <> 'pendiente_revision' then
    raise exception 'El asiento debe estar pendiente de revisión para confirmarse.';
  end if;

  select count(*)::integer,
    coalesce(sum(debe), 0)::numeric(14,2),
    coalesce(sum(haber), 0)::numeric(14,2)
  into v_lineas, v_debe, v_haber
  from public.contabilidad_asiento_lineas
  where asiento_id = p_asiento_id;

  if v_lineas < 2 then
    raise exception 'El asiento debe tener al menos dos líneas.';
  end if;
  if v_debe <= 0 or v_haber <= 0 or v_debe <> v_haber then
    raise exception 'El asiento no está equilibrado: debe %, haber %.', v_debe, v_haber;
  end if;

  select count(*)::integer into v_cuentas_invalidas
  from public.contabilidad_asiento_lineas l
  join public.contabilidad_plan_cuentas c on c.id = l.cuenta_id
  where l.asiento_id = p_asiento_id
    and (not c.activa or not c.permite_movimientos);
  if v_cuentas_invalidas > 0 then
    raise exception 'El asiento contiene cuentas inactivas o no imputables.';
  end if;

  update public.contabilidad_asientos
  set estado = 'confirmado',
    total_debe = v_debe,
    total_haber = v_haber,
    confirmado_por = auth.uid(),
    confirmado_at = now(),
    updated_at = now()
  where id = p_asiento_id;

  if v_asiento.documento_tipo = 'factura_emitida' and v_asiento.documento_id is not null then
    update public.facturas_emitidas
    set contabilidad_nativa_estado = 'confirmado'
    where id = v_asiento.documento_id
      and contabilidad_nativa_asiento_id = p_asiento_id;
  elsif v_asiento.documento_tipo = 'factura_recibida' and v_asiento.documento_id is not null then
    update public.facturas_gastos
    set contabilidad_nativa_estado = 'confirmado'
    where id = v_asiento.documento_id
      and contabilidad_nativa_asiento_id = p_asiento_id;
  end if;

  insert into public.contabilidad_asiento_auditoria (
    asiento_id, accion, estado_anterior, estado_nuevo, motivo, realizado_por
  ) values (
    p_asiento_id, 'confirmado', v_asiento.estado, 'confirmado',
    'Confirmación humana tras revisión del asiento.', auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'asiento_id', p_asiento_id,
    'estado', 'confirmado',
    'total', v_debe
  );
end;
$function$;

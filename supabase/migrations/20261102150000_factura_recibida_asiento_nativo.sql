-- Propone un asiento nativo cuando una factura recibida queda contabilizada
-- en el circuito existente de gastos.

create or replace function public.contabilidad_preparar_asiento_factura_recibida(p_factura_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_factura public.facturas_gastos%rowtype;
  v_gasto public.gastos%rowtype;
  v_ocr record;
  v_asiento_id uuid;
  v_cuenta_gasto uuid;
  v_cuenta_iva uuid;
  v_cuenta_proveedor uuid;
  v_base numeric(14,2);
  v_iva numeric(14,2);
  v_total numeric(14,2);
  v_fecha date;
  v_cuenta_codigo text;
  v_numero text;
begin
  if p_factura_id is null then
    raise exception 'factura_id obligatorio';
  end if;

  select * into v_factura
  from public.facturas_gastos
  where id = p_factura_id
  for update;

  if not found then
    raise exception 'factura recibida no encontrada';
  end if;

  if v_factura.contabilidad_nativa_asiento_id is not null then
    return jsonb_build_object(
      'success', true,
      'ya_existia', true,
      'asiento_id', v_factura.contabilidad_nativa_asiento_id
    );
  end if;

  select * into v_ocr
  from public.facturas_gastos_ocr
  where factura_id = p_factura_id
  order by created_at desc
  limit 1;

  if v_factura.gasto_id is not null then
    select * into v_gasto from public.gastos where id = v_factura.gasto_id;
  end if;

  v_base := round(coalesce(v_ocr.base_imponible, v_gasto.monto_bruto, 0)::numeric, 2);
  v_iva := round(coalesce(
    v_ocr.iva,
    v_gasto.monto_bruto * coalesce(v_gasto.iva, 0),
    0
  )::numeric, 2);
  v_total := round(coalesce(v_ocr.total, v_gasto.total_con_iva, v_base + v_iva)::numeric, 2);
  v_fecha := coalesce(v_ocr.fecha_factura, v_gasto.fecha_emision, v_factura.created_at::date, current_date);
  v_numero := coalesce(nullif(trim(v_ocr.numero_factura), ''), v_gasto.numero_factura, p_factura_id::text);

  if v_total = 0 or abs(v_total - (v_base + v_iva)) > 0.02 then
    raise exception 'La factura recibida tiene importes incompletos o descuadrados.';
  end if;

  if exists (
    select 1 from public.contabilidad_periodos
    where ejercicio = extract(year from v_fecha)::integer
      and mes = extract(month from v_fecha)::integer
      and estado = 'cerrado'
  ) then
    raise exception 'El periodo contable de % está cerrado y no admite facturas recibidas.', to_char(v_fecha, 'MM/YYYY');
  end if;

  v_cuenta_codigo := case
    when v_factura.asignacion_tipo = 'almacen' then '300'
    when v_factura.asignacion_tipo in ('obra', 'parte') then '600'
    else '629'
  end;

  select id into v_cuenta_gasto from public.contabilidad_plan_cuentas
  where codigo = v_cuenta_codigo and activa and permite_movimientos;
  select id into v_cuenta_iva from public.contabilidad_plan_cuentas
  where codigo = '472' and activa and permite_movimientos;
  select id into v_cuenta_proveedor from public.contabilidad_plan_cuentas
  where codigo = '400' and activa and permite_movimientos;

  if v_cuenta_gasto is null or v_cuenta_proveedor is null or (v_iva <> 0 and v_cuenta_iva is null) then
    raise exception 'Faltan las cuentas %, 400 o 472 en el plan contable.', v_cuenta_codigo;
  end if;

  insert into public.contabilidad_asientos (
    ejercicio, fecha_contable, fecha_documento, concepto, estado, origen,
    documento_tipo, documento_id, total_debe, total_haber, creado_por
  ) values (
    extract(year from v_fecha)::integer,
    v_fecha,
    v_fecha,
    format('Factura recibida %s · Proveedor', v_numero),
    'pendiente_revision',
    'factura_recibida',
    'factura_recibida',
    p_factura_id,
    abs(v_total),
    abs(v_total),
    auth.uid()
  ) returning id into v_asiento_id;

  if v_total > 0 then
    insert into public.contabilidad_asiento_lineas (
      asiento_id, orden, cuenta_id, descripcion, debe, haber,
      proveedor_id, obra_id, documento_tipo, documento_id, iva_base
    ) values (
      v_asiento_id, 1, v_cuenta_gasto, 'Compra o coste de factura recibida', v_base, 0,
      v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id, v_base
    );
    if v_iva <> 0 then
      insert into public.contabilidad_asiento_lineas (
        asiento_id, orden, cuenta_id, descripcion, debe, haber,
        proveedor_id, obra_id, documento_tipo, documento_id, iva_base
      ) values (
        v_asiento_id, 2, v_cuenta_iva, 'IVA soportado', v_iva, 0,
        v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id, v_base
      );
    end if;
    insert into public.contabilidad_asiento_lineas (
      asiento_id, orden, cuenta_id, descripcion, debe, haber,
      proveedor_id, obra_id, documento_tipo, documento_id
    ) values (
      v_asiento_id, 3, v_cuenta_proveedor, 'Deuda con proveedor', 0, v_total,
      v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id
    );
  else
    insert into public.contabilidad_asiento_lineas (
      asiento_id, orden, cuenta_id, descripcion, debe, haber,
      proveedor_id, obra_id, documento_tipo, documento_id
    ) values (
      v_asiento_id, 1, v_cuenta_proveedor, 'Abono o devolución de proveedor', abs(v_total), 0,
      v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id
    );
    insert into public.contabilidad_asiento_lineas (
      asiento_id, orden, cuenta_id, descripcion, debe, haber,
      proveedor_id, obra_id, documento_tipo, documento_id, iva_base
    ) values (
      v_asiento_id, 2, v_cuenta_gasto, 'Rectificación del coste', 0, abs(v_base),
      v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id, abs(v_base)
    );
    if v_iva <> 0 then
      insert into public.contabilidad_asiento_lineas (
        asiento_id, orden, cuenta_id, descripcion, debe, haber,
        proveedor_id, obra_id, documento_tipo, documento_id, iva_base
      ) values (
        v_asiento_id, 3, v_cuenta_iva, 'Rectificación del IVA soportado', 0, abs(v_iva),
        v_factura.proveedor_id, v_factura.obra_id, 'factura_recibida', p_factura_id, abs(v_base)
      );
    end if;
  end if;

  insert into public.contabilidad_asiento_auditoria (
    asiento_id, accion, estado_nuevo, motivo, realizado_por
  ) values (
    v_asiento_id,
    'creado',
    'pendiente_revision',
    'Propuesta automática desde factura recibida; requiere revisión humana.',
    auth.uid()
  );

  update public.facturas_gastos
  set contabilidad_nativa_estado = 'propuesta_preparada',
      contabilidad_nativa_asiento_id = v_asiento_id
  where id = p_factura_id;

  return jsonb_build_object('success', true, 'ya_existia', false, 'asiento_id', v_asiento_id);
end;
$function$;

revoke all on function public.contabilidad_preparar_asiento_factura_recibida(uuid) from public, anon, authenticated;

create or replace function public.contabilidad_proponer_asiento_factura_recibida_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.estado_contabilidad = 'contabilizado'
     and new.contabilidad_nativa_asiento_id is null then
    perform public.contabilidad_preparar_asiento_factura_recibida(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_factura_gasto_proponer_asiento_nativo on public.facturas_gastos;
create trigger trg_factura_gasto_proponer_asiento_nativo
after update of estado_contabilidad on public.facturas_gastos
for each row
when (new.estado_contabilidad = 'contabilizado' and new.contabilidad_nativa_asiento_id is null)
execute function public.contabilidad_proponer_asiento_factura_recibida_trigger();

comment on function public.contabilidad_preparar_asiento_factura_recibida(uuid) is
  'Prepara de forma idempotente el asiento nativo pendiente de revisión para una factura recibida.';

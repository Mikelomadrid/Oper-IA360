begin;

-- Reserva atómica previa a cualquier escritura en ContaSimple. Dos peticiones
-- concurrentes pueden validar la misma factura, pero solo una puede cambiarla
-- de lista_para_contasimple a procesando_contasimple.
create or replace function public.flopy_reclamar_envio_directo_contasimple(
  p_factura_id uuid,
  p_usuario_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_control public.facturas_gastos_contasimple_control%rowtype;
begin
  update public.facturas_gastos_contasimple_control
  set
    estado = 'procesando_contasimple',
    enviado_por = p_usuario_id,
    observaciones = 'Envío directo reservado por el conector. No reenviar mientras esté procesando.',
    error = null,
    updated_at = now()
  where factura_id = p_factura_id
    and estado = 'lista_para_contasimple'
    and contasimple_document_id is null
    and contasimple_ocr_request_id is null
  returning * into v_control;

  if v_control.factura_id is not null then
    return jsonb_build_object(
      'ok', true,
      'factura_id', p_factura_id,
      'estado_anterior', 'lista_para_contasimple',
      'estado_nuevo', 'procesando_contasimple'
    );
  end if;

  select *
  into v_control
  from public.facturas_gastos_contasimple_control
  where factura_id = p_factura_id;

  return jsonb_build_object(
    'ok', false,
    'error', case
      when v_control.factura_id is null then 'control_no_encontrado'
      when v_control.contasimple_document_id is not null
        or v_control.contasimple_ocr_request_id is not null then 'factura_ya_enviada'
      when v_control.estado = 'procesando_contasimple' then 'envio_ya_en_proceso'
      else 'estado_no_permite_envio'
    end,
    'estado_actual', v_control.estado,
    'contasimple_document_id', v_control.contasimple_document_id
  );
end;
$$;

comment on function public.flopy_reclamar_envio_directo_contasimple(uuid, uuid)
is 'Reserva atómicamente una factura antes de crear el documento en ContaSimple y evita dobles clics o reintentos simultáneos.';

revoke all on function public.flopy_reclamar_envio_directo_contasimple(uuid, uuid) from public;
grant execute on function public.flopy_reclamar_envio_directo_contasimple(uuid, uuid) to service_role;

-- La finalización ahora exige la reserva previa. Se conserva lista_para_contasimple
-- como compatibilidad para despliegues escalonados entre la función y la migración.
create or replace function public.flopy_registrar_factura_directa_contasimple(
  p_factura_id uuid,
  p_contasimple_document_id bigint,
  p_contasimple_document_number text default null,
  p_contasimple_document_amount numeric default null,
  p_contasimple_period text default null,
  p_usuario_id uuid default null,
  p_observaciones text default null,
  p_raw_contasimple jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado_actual text;
  v_document_type text;
begin
  if p_factura_id is null then
    return jsonb_build_object('ok', false, 'error', 'factura_id_obligatorio');
  end if;

  if p_contasimple_document_id is null then
    return jsonb_build_object('ok', false, 'error', 'contasimple_document_id_obligatorio');
  end if;

  select c.estado,
         case
           when coalesce(o.json_ocr ->> 'tipo_documento_erp', 'factura_recibida') = 'gasto'
             then 'expense'
           else 'receivedInvoice'
         end
  into v_estado_actual, v_document_type
  from public.facturas_gastos_contasimple_control c
  left join lateral (
    select json_ocr
    from public.facturas_gastos_ocr
    where factura_id = c.factura_id
    order by created_at desc
    limit 1
  ) o on true
  where c.factura_id = p_factura_id
  for update of c;

  if v_estado_actual is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'control_no_encontrado',
      'factura_id', p_factura_id
    );
  end if;

  if v_estado_actual not in ('procesando_contasimple', 'lista_para_contasimple') then
    return jsonb_build_object(
      'ok', false,
      'error', 'estado_no_permite_registro',
      'mensaje', 'La factura no tiene una reserva activa para completar el registro directo.',
      'estado_actual', v_estado_actual
    );
  end if;

  update public.facturas_gastos_contasimple_control
  set
    estado = 'creada_en_contasimple',
    contasimple_ocr_request_id = null,
    contasimple_ocr_status = null,
    contasimple_document_type = v_document_type,
    contasimple_document_id = p_contasimple_document_id,
    contasimple_document_number = p_contasimple_document_number,
    contasimple_document_amount = p_contasimple_document_amount,
    contasimple_period = p_contasimple_period,
    enviado_a_contasimple_at = now(),
    enviado_por = p_usuario_id,
    observaciones = coalesce(
      nullif(btrim(p_observaciones), ''),
      'Documento creado directamente por API desde ERP IA360, sin OCR ni archivo.'
    ),
    error = null,
    raw_contasimple = coalesce(p_raw_contasimple, '{}'::jsonb),
    updated_at = now()
  where factura_id = p_factura_id;

  return jsonb_build_object(
    'ok', true,
    'factura_id', p_factura_id,
    'estado_anterior', v_estado_actual,
    'estado_nuevo', 'creada_en_contasimple',
    'contasimple_document_type', v_document_type,
    'contasimple_document_id', p_contasimple_document_id,
    'contasimple_document_number', p_contasimple_document_number,
    'contasimple_document_amount', p_contasimple_document_amount,
    'contasimple_period', p_contasimple_period
  );
end;
$$;

revoke all on function public.flopy_registrar_factura_directa_contasimple(
  uuid, bigint, text, numeric, text, uuid, text, jsonb
) from public;
grant execute on function public.flopy_registrar_factura_directa_contasimple(
  uuid, bigint, text, numeric, text, uuid, text, jsonb
) to service_role;

commit;

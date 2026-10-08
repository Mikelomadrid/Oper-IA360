begin;

-- El conector directo solo lee datos ya validados por el ERP. No accede al
-- documento original y no utiliza el OCR de ContaSimple.
grant select on table public.facturas_gastos_lineas_ocr to service_role;
grant select on table public.proveedores to service_role;

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
begin
  if p_factura_id is null then
    return jsonb_build_object('ok', false, 'error', 'factura_id_obligatorio');
  end if;

  if p_contasimple_document_id is null then
    return jsonb_build_object('ok', false, 'error', 'contasimple_document_id_obligatorio');
  end if;

  select estado
  into v_estado_actual
  from public.facturas_gastos_contasimple_control
  where factura_id = p_factura_id
  for update;

  if v_estado_actual is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'control_no_encontrado',
      'factura_id', p_factura_id
    );
  end if;

  if v_estado_actual <> 'lista_para_contasimple' then
    return jsonb_build_object(
      'ok', false,
      'error', 'estado_no_permite_registro',
      'mensaje', 'Solo se puede registrar directamente una factura en estado lista_para_contasimple.',
      'estado_actual', v_estado_actual
    );
  end if;

  update public.facturas_gastos_contasimple_control
  set
    estado = 'creada_en_contasimple',
    contasimple_ocr_request_id = null,
    contasimple_ocr_status = null,
    contasimple_document_type = 'receivedInvoice',
    contasimple_document_id = p_contasimple_document_id,
    contasimple_document_number = p_contasimple_document_number,
    contasimple_document_amount = p_contasimple_document_amount,
    contasimple_period = p_contasimple_period,
    enviado_a_contasimple_at = now(),
    enviado_por = p_usuario_id,
    observaciones = coalesce(
      nullif(btrim(p_observaciones), ''),
      'Factura creada directamente por API desde ERP IA360, sin OCR ni archivo.'
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
    'contasimple_document_id', p_contasimple_document_id,
    'contasimple_document_number', p_contasimple_document_number,
    'contasimple_document_amount', p_contasimple_document_amount,
    'contasimple_period', p_contasimple_period
  );
end;
$$;

comment on function public.flopy_registrar_factura_directa_contasimple(
  uuid, bigint, text, numeric, text, uuid, text, jsonb
) is 'Registra el alta directa de una factura recibida en ContaSimple sin usar OCR ni subir el documento.';

revoke all on function public.flopy_registrar_factura_directa_contasimple(
  uuid, bigint, text, numeric, text, uuid, text, jsonb
) from public;

grant execute on function public.flopy_registrar_factura_directa_contasimple(
  uuid, bigint, text, numeric, text, uuid, text, jsonb
) to service_role;

commit;

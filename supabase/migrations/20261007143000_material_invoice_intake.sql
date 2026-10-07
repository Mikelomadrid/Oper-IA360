-- Entrada transaccional de facturas de materiales desde foto/OCR.
-- Entorno objetivo inicial: Supabase de desarrollo.
-- No envía a Contasimple: deja la factura validada en su cola de salida.

begin;

create or replace function public.ia360_registrar_factura_materiales_desde_ocr(
  p_subido_por uuid,
  p_obra_id uuid,
  p_proveedor_id uuid,
  p_imagen_url text,
  p_proveedor_nombre text,
  p_proveedor_nif text,
  p_numero_factura text,
  p_fecha_factura date,
  p_base_imponible numeric,
  p_iva_importe numeric,
  p_total numeric,
  p_json_ocr jsonb,
  p_lineas jsonb,
  p_confianza_ocr numeric default null,
  p_motor_ocr text default 'openai_vision'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicada jsonb;
  v_registro jsonb;
  v_factura_id uuid;
  v_contabilizacion jsonb;
  v_linea record;
  v_iva_ajustado numeric(12,2);
  v_lineas_validadas integer := 0;
begin
  if p_subido_por is null or p_obra_id is null or p_proveedor_id is null then
    raise exception 'empleado, obra y proveedor son obligatorios';
  end if;

  if auth.role() <> 'service_role' and not exists (
    select 1
    from public.empleados e
    where e.id = p_subido_por
      and e.auth_user_id = auth.uid()
      and coalesce(e.activo, true) = true
      and coalesce(e.baja, false) = false
  ) then
    raise exception 'el empleado no corresponde al usuario autenticado';
  end if;

  if nullif(trim(coalesce(p_imagen_url, '')), '') is null then
    raise exception 'la imagen de la factura es obligatoria';
  end if;

  if nullif(trim(coalesce(p_numero_factura, '')), '') is null
     or p_fecha_factura is null
     or coalesce(p_base_imponible, 0) <= 0
     or coalesce(p_total, 0) <= 0 then
    raise exception 'número, fecha, base imponible y total son obligatorios';
  end if;

  if p_lineas is null
     or jsonb_typeof(p_lineas) <> 'array'
     or jsonb_array_length(p_lineas) = 0 then
    raise exception 'la factura debe contener al menos una línea de material';
  end if;

  if abs((p_base_imponible + coalesce(p_iva_importe, 0)) - p_total) > 0.02 then
    raise exception 'los importes no cuadran: base + IVA debe coincidir con el total';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lineas) l
    where nullif(trim(coalesce(l->>'referencia', '')), '') is null
       or nullif(trim(coalesce(l->>'descripcion', '')), '') is null
       or nullif(trim(coalesce(l->>'unidad', '')), '') is null
       or coalesce(nullif(l->>'cantidad', '')::numeric, 0) <= 0
       or coalesce(nullif(l->>'precio_unitario', '')::numeric, 0) < 0
  ) then
    raise exception 'todas las líneas necesitan referencia, descripción, unidad, cantidad y precio';
  end if;

  v_duplicada := public.flopy_verificar_factura_duplicada(
    p_proveedor_nif,
    p_numero_factura,
    p_total
  );

  if coalesce((v_duplicada->>'duplicada')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'duplicada', true,
      'error', 'factura_duplicada',
      'coincidencia', v_duplicada
    );
  end if;

  v_iva_ajustado := round(p_total - p_base_imponible, 2);

  v_registro := public.flopy_registrar_factura_completa_desde_foto(
    p_subido_por,
    p_obra_id,
    'materiales',
    p_imagen_url,
    'erp_ocr_openai',
    p_proveedor_nombre,
    p_proveedor_nif,
    p_numero_factura,
    p_fecha_factura,
    p_base_imponible,
    v_iva_ajustado,
    p_total,
    null,
    p_confianza_ocr,
    p_motor_ocr,
    coalesce(p_json_ocr, '{}'::jsonb),
    p_lineas
  );

  v_factura_id := nullif(v_registro->>'factura_id', '')::uuid;

  update public.facturas_gastos
  set proveedor_id = p_proveedor_id
  where id = v_factura_id;

  perform public.flopy_asignar_factura_gasto(
    v_factura_id,
    p_subido_por,
    'obra',
    p_obra_id,
    null,
    'Asignada desde escáner OCR de materiales'
  );

  for v_linea in
    select *
    from public.facturas_gastos_lineas_ocr
    where factura_id = v_factura_id
      and es_material = true
    order by numero_linea nulls last, created_at
  loop
    perform public.flopy_revisar_linea_factura_gasto(
      v_linea.id,
      p_subido_por,
      'validada',
      v_linea.referencia,
      v_linea.descripcion,
      v_linea.categoria,
      v_linea.cantidad,
      v_linea.unidad,
      v_linea.precio_unitario,
      v_linea.base_linea,
      v_linea.iva_porcentaje,
      v_linea.iva_importe,
      v_linea.total_linea,
      'Revisada en el escáner antes de guardar'
    );
    v_lineas_validadas := v_lineas_validadas + 1;
  end loop;

  perform public.flopy_confirmar_factura_gasto(
    v_factura_id,
    p_subido_por,
    'validado',
    'Cabecera e importes revisados en el escáner'
  );

  v_contabilizacion := public.ia360_contabilizar_factura_materiales_erp(
    v_factura_id,
    p_subido_por,
    'pendiente_pago'
  );

  insert into public.facturas_gastos_contasimple_control (
    factura_id,
    estado,
    observaciones,
    updated_at
  )
  values (
    v_factura_id,
    'lista_para_contasimple',
    'Factura OCR validada y lista para envío cuando se habilite la escritura API',
    now()
  )
  on conflict (factura_id) do update
  set
    estado = 'lista_para_contasimple',
    observaciones = excluded.observaciones,
    error = null,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'duplicada', false,
    'factura_id', v_factura_id,
    'gasto_id', v_contabilizacion->>'gasto_id',
    'obra_id', p_obra_id,
    'proveedor_id', p_proveedor_id,
    'lineas_validadas', v_lineas_validadas,
    'auditoria', v_contabilizacion,
    'contasimple', 'lista_para_contasimple'
  );
end;
$$;

revoke all on function public.ia360_registrar_factura_materiales_desde_ocr(
  uuid, uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) from public, anon;

grant execute on function public.ia360_registrar_factura_materiales_desde_ocr(
  uuid, uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) to authenticated, service_role;

comment on function public.ia360_registrar_factura_materiales_desde_ocr(
  uuid, uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) is 'Registra una factura OCR de materiales de forma transaccional, contabiliza unidades/coste y la deja en cola para Contasimple.';

commit;

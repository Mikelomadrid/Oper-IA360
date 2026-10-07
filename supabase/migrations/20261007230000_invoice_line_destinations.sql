-- Distribucion interna de facturas OCR por linea.
-- Una factura fiscal se registra una sola vez; sus materiales pueden repartirse
-- entre varias obras, gastos generales y el almacen propio.

begin;

create table if not exists public.factura_gasto_linea_asignaciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_gastos(id) on delete cascade,
  linea_ocr_id uuid not null references public.facturas_gastos_lineas_ocr(id) on delete cascade,
  destino_tipo text not null,
  obra_id uuid references public.proyectos(id) on delete restrict,
  descripcion text not null,
  referencia text,
  cantidad numeric(14,3) not null,
  unidad text not null default 'ud',
  precio_unitario numeric(14,4) not null default 0,
  importe_base numeric(14,2) not null default 0,
  producto_catalogo_id uuid references public.catalogo_proveedor_productos(id) on delete set null,
  material_previsto_id uuid references public.obra_materiales_previstos(id) on delete set null,
  material_almacen_id uuid references public.materiales(id) on delete set null,
  estado_auditoria text not null default 'pendiente_revision',
  creado_por uuid references public.empleados(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint factura_linea_asignaciones_destino_chk
    check (destino_tipo in ('obra', 'general', 'almacen')),
  constraint factura_linea_asignaciones_obra_chk
    check (
      (destino_tipo = 'obra' and obra_id is not null)
      or (destino_tipo <> 'obra' and obra_id is null)
    ),
  constraint factura_linea_asignaciones_cantidad_chk check (cantidad > 0),
  constraint factura_linea_asignaciones_precio_chk check (precio_unitario >= 0),
  constraint factura_linea_asignaciones_estado_chk
    check (estado_auditoria in (
      'conciliado', 'no_previsto', 'unidad_incompatible',
      'exceso_cantidad', 'pendiente_revision', 'no_aplica'
    ))
);

create index if not exists idx_factura_linea_asig_factura
  on public.factura_gasto_linea_asignaciones(factura_id);
create index if not exists idx_factura_linea_asig_obra
  on public.factura_gasto_linea_asignaciones(obra_id)
  where obra_id is not null;
create index if not exists idx_factura_linea_asig_linea
  on public.factura_gasto_linea_asignaciones(linea_ocr_id);

create table if not exists public.almacen_material_movimientos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiales(id) on delete restrict,
  tipo text not null,
  cantidad numeric(14,3) not null,
  coste_unitario numeric(14,4) not null default 0,
  valor_total numeric(14,2) not null default 0,
  factura_id uuid references public.facturas_gastos(id) on delete set null,
  linea_ocr_id uuid references public.facturas_gastos_lineas_ocr(id) on delete set null,
  obra_origen_id uuid references public.proyectos(id) on delete set null,
  obra_destino_id uuid references public.proyectos(id) on delete set null,
  realizado_por uuid references public.empleados(id) on delete set null,
  observaciones text,
  created_at timestamptz not null default now(),
  constraint almacen_material_mov_tipo_chk
    check (tipo in ('entrada_factura', 'devolucion_obra', 'salida_obra', 'ajuste')),
  constraint almacen_material_mov_cantidad_chk check (cantidad > 0)
);

create index if not exists idx_almacen_mov_linea_factura
  on public.almacen_material_movimientos(linea_ocr_id)
  where linea_ocr_id is not null;

alter table public.factura_gasto_linea_asignaciones enable row level security;
alter table public.almacen_material_movimientos enable row level security;

drop policy if exists factura_linea_asignaciones_gestion on public.factura_gasto_linea_asignaciones;
create policy factura_linea_asignaciones_gestion
on public.factura_gasto_linea_asignaciones
to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists almacen_material_movimientos_gestion on public.almacen_material_movimientos;
create policy almacen_material_movimientos_gestion
on public.almacen_material_movimientos
to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

grant select, insert, update, delete on public.factura_gasto_linea_asignaciones to authenticated, service_role;
grant select, insert, update, delete on public.almacen_material_movimientos to authenticated, service_role;

create or replace function public.ia360_registrar_factura_distribuida_desde_ocr(
  p_subido_por uuid,
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
  v_gasto_result jsonb;
  v_gasto_id uuid;
  v_linea_input jsonb;
  v_linea public.facturas_gastos_lineas_ocr%rowtype;
  v_asig jsonb;
  v_destino text;
  v_obra_id uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_importe numeric;
  v_suma numeric;
  v_catalogo_result jsonb;
  v_producto_catalogo_id uuid;
  v_producto_maestro_id uuid;
  v_previsto public.obra_materiales_previstos%rowtype;
  v_estado text;
  v_unidad text;
  v_material_id uuid;
  v_stock numeric;
  v_coste_actual numeric;
  v_header_obra uuid;
  v_es_una_obra boolean;
  v_lineas_validadas integer := 0;
  v_asignaciones_creadas integer := 0;
begin
  if p_subido_por is null or p_proveedor_id is null then
    raise exception 'empleado y proveedor son obligatorios';
  end if;

  if auth.role() <> 'service_role' and not public.app_is_admin_or_encargado() then
    raise exception 'solo administracion o encargado pueden contabilizar la factura';
  end if;

  if auth.role() <> 'service_role' and not exists (
    select 1 from public.empleados e
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
    raise exception 'numero, fecha, base imponible y total son obligatorios';
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'la factura debe contener al menos una linea';
  end if;

  if abs((p_base_imponible + coalesce(p_iva_importe, 0)) - p_total) > 0.02 then
    raise exception 'los importes no cuadran: base + IVA debe coincidir con el total';
  end if;

  for v_linea_input in select value from jsonb_array_elements(p_lineas)
  loop
    if nullif(trim(coalesce(v_linea_input->>'referencia', '')), '') is null
       or nullif(trim(coalesce(v_linea_input->>'descripcion', '')), '') is null
       or nullif(trim(coalesce(v_linea_input->>'unidad', '')), '') is null
       or coalesce(nullif(v_linea_input->>'cantidad', '')::numeric, 0) <= 0
       or coalesce(nullif(v_linea_input->>'precio_unitario', '')::numeric, 0) < 0 then
      raise exception 'todas las lineas necesitan referencia, descripcion, unidad, cantidad y precio';
    end if;

    if jsonb_typeof(v_linea_input->'asignaciones') <> 'array'
       or jsonb_array_length(v_linea_input->'asignaciones') = 0 then
      raise exception 'cada linea debe tener al menos un destino';
    end if;

    select coalesce(sum((a->>'cantidad')::numeric), 0)
    into v_suma
    from jsonb_array_elements(v_linea_input->'asignaciones') a;

    if abs(v_suma - (v_linea_input->>'cantidad')::numeric) > 0.001 then
      raise exception 'el reparto de la linea % no coincide con su cantidad', v_linea_input->>'numero_linea';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(v_linea_input->'asignaciones') a
      where coalesce((a->>'cantidad')::numeric, 0) <= 0
         or coalesce(a->>'destino_tipo', '') not in ('obra', 'general', 'almacen')
         or (
           a->>'destino_tipo' = 'obra'
           and nullif(a->>'obra_id', '') is null
         )
    ) then
      raise exception 'hay destinos incompletos o cantidades no validas';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_lineas) l,
         jsonb_array_elements(l->'asignaciones') a
    where a->>'destino_tipo' = 'obra'
      and not exists (
        select 1 from public.proyectos p
        where p.id = (a->>'obra_id')::uuid
      )
  ) then
    raise exception 'alguna obra asignada no existe';
  end if;

  v_duplicada := public.flopy_verificar_factura_duplicada(
    p_proveedor_nif, p_numero_factura, p_total
  );
  if coalesce((v_duplicada->>'duplicada')::boolean, false) then
    return jsonb_build_object('ok', false, 'duplicada', true, 'error', 'factura_duplicada');
  end if;

  select
    bool_and(a->>'destino_tipo' = 'obra')
      and count(distinct a->>'obra_id') = 1,
    min(nullif(a->>'obra_id', ''))::uuid
  into v_es_una_obra, v_header_obra
  from jsonb_array_elements(p_lineas) l,
       jsonb_array_elements(l->'asignaciones') a;

  v_registro := public.flopy_registrar_factura_completa_desde_foto(
    p_subido_por,
    case when v_es_una_obra then v_header_obra else null end,
    'materiales',
    p_imagen_url,
    'erp_ocr_openai_distribuido',
    p_proveedor_nombre,
    p_proveedor_nif,
    p_numero_factura,
    p_fecha_factura,
    p_base_imponible,
    round(p_total - p_base_imponible, 2),
    p_total,
    null,
    p_confianza_ocr,
    p_motor_ocr,
    coalesce(p_json_ocr, '{}'::jsonb),
    p_lineas
  );
  v_factura_id := nullif(v_registro->>'factura_id', '')::uuid;

  update public.facturas_gastos set proveedor_id = p_proveedor_id where id = v_factura_id;

  perform public.flopy_asignar_factura_gasto(
    v_factura_id,
    p_subido_por,
    case when v_es_una_obra then 'obra' else 'general' end,
    case when v_es_una_obra then v_header_obra else null end,
    null,
    case when v_es_una_obra
      then 'Factura asignada completamente a una obra desde OCR'
      else 'Factura distribuida internamente por lineas desde OCR'
    end
  );

  for v_linea_input in select value from jsonb_array_elements(p_lineas)
  loop
    select * into v_linea
    from public.facturas_gastos_lineas_ocr
    where factura_id = v_factura_id
      and numero_linea = (v_linea_input->>'numero_linea')::integer
    order by created_at
    limit 1;

    if v_linea.id is null then
      raise exception 'no se encontro la linea OCR %', v_linea_input->>'numero_linea';
    end if;

    perform public.flopy_revisar_linea_factura_gasto(
      v_linea.id, p_subido_por, 'validada',
      v_linea.referencia, v_linea.descripcion, v_linea.categoria,
      v_linea.cantidad, v_linea.unidad, v_linea.precio_unitario,
      v_linea.base_linea, v_linea.iva_porcentaje, v_linea.iva_importe,
      v_linea.total_linea, 'Revisada y distribuida en el escaner'
    );
    v_lineas_validadas := v_lineas_validadas + 1;

    v_catalogo_result := public.flopy_alimentar_catalogo_desde_linea(v_linea.id);
    v_producto_catalogo_id := case
      when coalesce((v_catalogo_result->>'ok')::boolean, false)
        then nullif(v_catalogo_result->>'producto_id', '')::uuid
      else null
    end;
    v_producto_maestro_id := null;
    if v_producto_catalogo_id is not null then
      select producto_maestro_id into v_producto_maestro_id
      from public.catalogo_proveedor_productos
      where id = v_producto_catalogo_id;
    end if;

    v_unidad := public.ia360_normalizar_unidad(v_linea.unidad);
    v_precio := coalesce(
      v_linea.precio_unitario,
      case when coalesce(v_linea.cantidad, 0) <> 0 then v_linea.base_linea / v_linea.cantidad end,
      0
    );

    for v_asig in select value from jsonb_array_elements(v_linea_input->'asignaciones')
    loop
      v_destino := v_asig->>'destino_tipo';
      v_obra_id := case when v_destino = 'obra' then (v_asig->>'obra_id')::uuid else null end;
      v_cantidad := (v_asig->>'cantidad')::numeric;
      v_importe := round(v_cantidad * v_precio, 2);
      v_previsto.id := null;
      v_estado := 'no_aplica';
      v_material_id := null;

      if v_destino = 'obra' then
        select mp.* into v_previsto
        from public.obra_materiales_previstos mp
        where mp.obra_id = v_obra_id
          and mp.activo = true
          and mp.estado = 'confirmado'
          and (
            (v_producto_catalogo_id is not null and mp.producto_catalogo_id = v_producto_catalogo_id)
            or (v_producto_maestro_id is not null and mp.producto_maestro_id = v_producto_maestro_id)
            or (
              lower(regexp_replace(trim(mp.descripcion), '\s+', ' ', 'g')) =
              lower(regexp_replace(trim(v_linea.descripcion), '\s+', ' ', 'g'))
              and public.ia360_normalizar_unidad(mp.unidad) = v_unidad
            )
          )
        order by mp.created_at
        limit 1;

        if v_previsto.id is null then
          v_estado := 'no_previsto';
        elsif public.ia360_normalizar_unidad(v_previsto.unidad) <> v_unidad then
          v_estado := 'unidad_incompatible';
        else
          v_estado := 'conciliado';
        end if;
      elsif v_destino = 'almacen' then
        select m.id, m.stock_actual, m.precio_coste
        into v_material_id, v_stock, v_coste_actual
        from public.materiales m
        where upper(trim(m.codigo)) = upper(trim(v_linea.referencia))
        order by m.fecha_creacion
        limit 1
        for update;

        if v_material_id is null then
          insert into public.materiales (
            codigo, descripcion, nombre, unidad_medida, stock_actual,
            stock_inicial, precio_coste, categoria, proveedor_id, created_by
          ) values (
            v_linea.referencia, v_linea.descripcion, v_linea.descripcion,
            v_unidad, v_cantidad, 0, v_precio, v_linea.categoria,
            p_proveedor_id, p_subido_por
          ) returning id into v_material_id;
        else
          update public.materiales
          set
            precio_coste = case
              when coalesce(v_stock, 0) + v_cantidad = 0 then v_precio
              else round(((coalesce(v_stock, 0) * coalesce(v_coste_actual, 0)) + (v_cantidad * v_precio)) / (coalesce(v_stock, 0) + v_cantidad), 4)
            end,
            stock_actual = coalesce(v_stock, 0) + v_cantidad,
            proveedor_id = coalesce(proveedor_id, p_proveedor_id)
          where id = v_material_id;
        end if;

        insert into public.almacen_material_movimientos (
          material_id, tipo, cantidad, coste_unitario, valor_total,
          factura_id, linea_ocr_id, realizado_por, observaciones
        ) values (
          v_material_id, 'entrada_factura', v_cantidad, v_precio, v_importe,
          v_factura_id, v_linea.id, p_subido_por,
          'Entrada desde factura OCR distribuida'
        );
      end if;

      insert into public.factura_gasto_linea_asignaciones (
        factura_id, linea_ocr_id, destino_tipo, obra_id, descripcion,
        referencia, cantidad, unidad, precio_unitario, importe_base,
        producto_catalogo_id, material_previsto_id, material_almacen_id,
        estado_auditoria, creado_por
      ) values (
        v_factura_id, v_linea.id, v_destino, v_obra_id, v_linea.descripcion,
        v_linea.referencia, v_cantidad, v_unidad, v_precio, v_importe,
        v_producto_catalogo_id, v_previsto.id, v_material_id,
        v_estado, p_subido_por
      );
      v_asignaciones_creadas := v_asignaciones_creadas + 1;
    end loop;
  end loop;

  perform public.flopy_confirmar_factura_gasto(
    v_factura_id, p_subido_por, 'validado',
    'Cabecera, importes y destinos por linea revisados en el escaner'
  );

  v_gasto_result := public.flopy_contabilizar_factura_gasto_en_gastos(
    v_factura_id, p_subido_por, 'pendiente_pago',
    'Factura distribuida por lineas por IA360'
  );
  v_gasto_id := nullif(v_gasto_result->>'gasto_id', '')::uuid;

  insert into public.facturas_gastos_contasimple_control (
    factura_id, estado, observaciones, updated_at
  ) values (
    v_factura_id, 'lista_para_contasimple',
    'Factura OCR validada una sola vez; distribucion interna guardada en ERP', now()
  )
  on conflict (factura_id) do update set
    estado = excluded.estado,
    observaciones = excluded.observaciones,
    error = null,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'factura_id', v_factura_id,
    'gasto_id', v_gasto_id,
    'lineas_validadas', v_lineas_validadas,
    'asignaciones_creadas', v_asignaciones_creadas,
    'asignacion_cabecera', case when v_es_una_obra then 'obra' else 'general_distribuida' end,
    'contasimple', 'lista_para_contasimple'
  );
end;
$$;

revoke all on function public.ia360_registrar_factura_distribuida_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) from public, anon;

grant execute on function public.ia360_registrar_factura_distribuida_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) to authenticated, service_role;

comment on function public.ia360_registrar_factura_distribuida_desde_ocr(
  uuid, uuid, text, text, text, text, date, numeric, numeric, numeric,
  jsonb, jsonb, numeric, text
) is 'Registra una factura una sola vez y distribuye cada linea entre obras, gastos generales y almacen.';

commit;

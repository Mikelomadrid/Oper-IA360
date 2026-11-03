-- Corrige la automatización de movimientos bancarios al registrar pagos.
-- La versión anterior usaba ON CONFLICT sobre una combinación que no tenía
-- una restricción única en la tabla, provocando el fallo del registro.

create or replace function public.contabilidad_crear_movimiento_pago_factura()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.estado = 'registrado'
     and new.medio_pago = 'banco'
     and new.cuenta_bancaria_id is not null then
    if not exists (
      select 1
      from public.contabilidad_movimientos_bancarios
      where cuenta_bancaria_id = new.cuenta_bancaria_id
        and hash_externo = 'pago_factura:' || new.id::text
    ) then
      insert into public.contabilidad_movimientos_bancarios (
        cuenta_bancaria_id,
        fecha,
        fecha_valor,
        concepto,
        importe,
        referencia,
        origen,
        estado,
        hash_externo,
        asiento_id,
        creado_por
      ) values (
        new.cuenta_bancaria_id,
        new.fecha_pago,
        new.fecha_pago,
        format('Pago factura recibida %s', new.factura_id),
        -round(new.importe, 2),
        coalesce(nullif(btrim(new.referencia), ''), 'PAGO-' || new.id::text),
        'manual',
        'pendiente',
        'pago_factura:' || new.id::text,
        new.contabilidad_asiento_id,
        new.creado_por
      );
    end if;
  end if;

  return new;
end;
$$;

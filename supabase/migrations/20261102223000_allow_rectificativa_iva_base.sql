-- Las facturas rectificativas pueden llevar base e IVA negativos.
-- Se mantiene la validación para el resto de líneas contables.
alter table public.contabilidad_asiento_lineas
  drop constraint if exists contabilidad_asiento_lineas_iva_base_check;

alter table public.contabilidad_asiento_lineas
  add constraint contabilidad_asiento_lineas_iva_base_check
  check (
    iva_base is null
    or iva_base >= 0
    or (
      documento_tipo = 'factura_recibida'
      and descripcion ilike 'Rectificación%'
    )
  );

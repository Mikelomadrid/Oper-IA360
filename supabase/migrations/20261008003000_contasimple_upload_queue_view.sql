begin;

create or replace view public.v_contasimple_admin_bandeja_facturas as
with docs as (
  select
    d.factura_id,
    d.fecha_registro,
    d.obra_id,
    d.parte_id,
    d.proveedor_nombre,
    d.proveedor_nif,
    d.numero_factura,
    d.fecha_factura,
    d.total,
    d.documento_id,
    d.ruta_original,
    d.thumbnail_bucket,
    d.thumbnail_path,
    row_number() over (partition by d.factura_id order by d.documento_id) as rn
  from public.v_facturas_gastos_documentos_app d
), base as (
  select
    docs.factura_id,
    docs.fecha_registro,
    docs.obra_id,
    docs.parte_id,
    docs.proveedor_nombre,
    docs.proveedor_nif,
    docs.numero_factura,
    docs.fecha_factura,
    docs.total,
    docs.documento_id,
    docs.ruta_original,
    docs.thumbnail_bucket,
    docs.thumbnail_path
  from docs
  where docs.rn = 1
)
select
  b.factura_id,
  b.fecha_registro,
  b.obra_id,
  b.parte_id,
  b.proveedor_nombre,
  b.proveedor_nif,
  b.numero_factura,
  b.fecha_factura,
  b.total,
  b.documento_id,
  b.ruta_original,
  b.thumbnail_bucket,
  b.thumbnail_path,
  case
    when c.estado in ('contabilizada', 'rechazada_no_contabilizable') then c.estado
    else 'pendiente'
  end as estado,
  c.observaciones,
  c.contabilizado_at,
  c.contabilizado_por,
  c.estado as estado_contasimple,
  c.contasimple_ocr_request_id,
  c.contasimple_ocr_status,
  c.contasimple_document_id,
  c.contasimple_document_number,
  c.contasimple_document_amount,
  c.contasimple_period,
  c.enviado_a_contasimple_at,
  c.error as contasimple_error
from base b
left join public.facturas_gastos_contasimple_control c on c.factura_id = b.factura_id;

grant select on public.v_contasimple_admin_bandeja_facturas to authenticated, service_role;

comment on view public.v_contasimple_admin_bandeja_facturas is
  'Bandeja ERP de facturas con trazabilidad del envío OCR a ContaSimple.';

commit;

-- Permite cerrar la recepción de pedidos de material después de la entrega.
alter type public.request_status add value if not exists 'recibido';

-- Anticipos: la UI usa la tabla para listar, editar, eliminar y adjuntar justificantes.
-- Las políticas RLS existentes siguen limitando qué filas puede tocar cada usuario.
grant select, insert, update, delete on table public.anticipos_nomina to authenticated, service_role;

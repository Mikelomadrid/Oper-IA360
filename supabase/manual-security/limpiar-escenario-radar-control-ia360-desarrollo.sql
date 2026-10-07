-- Limpieza del escenario ficticio del Centro de Control IA360.
-- Aplicar exclusivamente en desarrollo-seguro (obigqojehfxxgfluygdg).
-- No ejecutar sin confirmacion, ya que elimina registros de prueba.

begin;

delete from public.notificaciones
where referencia_id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006'
  )
  or entidad_id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006'
  );

delete from public.tareas
where id in (
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
);

delete from public.gastos
where id = '20000000-0000-4000-8000-000000000003';

delete from public.partes
where id = '20000000-0000-4000-8000-000000000006';

delete from public.proyectos
where id = '20000000-0000-4000-8000-000000000001';

update public.leads
set nombre_contacto = 'Contacto ficticio IA360',
    nombre_empresa = '[PRUEBA IA360] Empresa ficticia',
    updated_at = now()
where id = '10000000-0000-4000-8000-000000000002';

commit;

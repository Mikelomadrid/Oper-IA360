-- Escenario reproducible para validar el Centro de Control IA360.
-- Aplicar exclusivamente en desarrollo-seguro (obigqojehfxxgfluygdg).
-- Todos los registros son ficticios y usan UUID reservados 20000000-....

begin;

-- Se reutiliza el lead ficticio original porque sus triggers de propietario
-- requieren el contexto de autenticacion de la aplicacion.
update public.leads
set nombre_contacto = '[PRUEBA IA360] Contacto sin seguimiento',
    nombre_empresa = '[PRUEBA IA360] Empresa ficticia inactiva',
    estado = 'nuevo',
    archivado = false,
    updated_at = now() - interval '12 days'
where id = '10000000-0000-4000-8000-000000000002';

insert into public.proyectos (
  id, nombre_proyecto, descripcion, estado, fecha_inicio,
  fecha_fin_estimada, presupuesto_aceptado, objetivo_margen_pct,
  gastos_generales_estimados
)
values (
  '20000000-0000-4000-8000-000000000001',
  '[PRUEBA IA360] Obra retrasada',
  'Registro ficticio para validar el radar operativo IA360.',
  'activo', current_date - 20, current_date - 4, 1000, 15, 0
)
on conflict (id) do update set
  nombre_proyecto = excluded.nombre_proyecto,
  descripcion = excluded.descripcion,
  estado = excluded.estado,
  fecha_inicio = excluded.fecha_inicio,
  fecha_fin_estimada = excluded.fecha_fin_estimada;

insert into public.gastos (
  id, proyecto_id, numero_factura, fecha_emision, fecha_vencimiento,
  monto_bruto, iva, estado_pago, concepto
)
values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  'PRUEBA-IA360-VENCIDA-001', current_date - 20, current_date - 5,
  100, 0.21, 'pendiente_pago',
  '[PRUEBA IA360] Factura ficticia vencida'
)
on conflict (id) do update set
  fecha_vencimiento = excluded.fecha_vencimiento,
  estado_pago = excluded.estado_pago,
  concepto = excluded.concepto;

insert into public.tareas (
  id, proyecto_id, empleado_asignado_id, titulo, descripcion, estado,
  fecha_limite
)
values
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000003',
    'b462e3c5-42d6-4c9e-b64f-ec9fb66b280e',
    '[PRUEBA IA360] Tarea vencida',
    'Caso ficticio para validar el carril urgente.',
    'pendiente', current_date - 2
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    null,
    '[PRUEBA IA360] Tarea sin responsable',
    'Caso ficticio para validar el carril sin seguimiento.',
    'pendiente', current_date + 20
  )
on conflict (id) do update set
  empleado_asignado_id = excluded.empleado_asignado_id,
  titulo = excluded.titulo,
  descripcion = excluded.descripcion,
  estado = excluded.estado,
  fecha_limite = excluded.fecha_limite;

insert into public.partes (
  id, created_at, created_by, tecnico_asignado_id, estado,
  descripcion_trabajo, cliente_nombre, direccion_servicio,
  fecha_visita, visita_agendada_at, custom_id, deleted_at
)
values (
  '20000000-0000-4000-8000-000000000006',
  now() - interval '5 days',
  'dcf6ded4-0ebe-4f32-8abd-20804db8b6d5',
  null, 'nuevo',
  '[PRUEBA IA360] Parte pendiente sin visita programada.',
  '[PRUEBA IA360] Cliente radar',
  'Direccion ficticia 1, Madrid',
  null, null, 'PRUEBA-IA360-RADAR-002', null
)
on conflict (id) do update set
  estado = excluded.estado,
  fecha_visita = null,
  visita_agendada_at = null,
  deleted_at = null;

commit;

select 'proyectos' as tabla, count(*) as registros
from public.proyectos
where id = '20000000-0000-4000-8000-000000000001'
union all
select 'leads', count(*) from public.leads
where id = '10000000-0000-4000-8000-000000000002'
  and updated_at < now() - interval '7 days'
union all
select 'gastos', count(*) from public.gastos
where id = '20000000-0000-4000-8000-000000000003'
union all
select 'tareas', count(*) from public.tareas
where id in (
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
)
union all
select 'partes', count(*) from public.partes
where id = '20000000-0000-4000-8000-000000000006';

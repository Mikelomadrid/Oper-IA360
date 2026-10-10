# Punto de restauración — emisión y versionado de presupuestos v1

Fecha: 2026-10-10

## Alcance terminado

- El borrador de presupuesto continúa siendo editable.
- La acción **Emitir presupuesto** crea una fotografía inmutable del contenido y los importes.
- La primera emisión recibe numeración anual `PRE-AAAA-0001`.
- Las emisiones posteriores del mismo borrador conservan el número y aumentan la versión.
- El PDF definitivo se descarga con el número y la versión emitidos.
- La pantalla muestra un historial de emisiones con estado, fecha, base imponible y total.
- Emitir no crea una obra y no envía información a ContaSimple.

## Base de datos de desarrollo

Migración aplicada en Supabase `NuevaERP desarrollo-seguro` (`obigqojehfxxgfluygdg`):

- `public.presupuesto_emisiones`
- `public.emitir_presupuesto_visita(uuid, jsonb, jsonb)`
- RLS de lectura para usuarios autenticados con permiso sobre el lead.
- Escritura directa bloqueada para usuarios; la emisión se realiza mediante la función controlada.

Archivo de migración:

- `supabase/migrations/20261010200000_versiones_emision_presupuesto.sql`

## Aplicación

Componente actualizado:

- `src/components/LeadVisitBudget.jsx`

Validaciones realizadas:

- ESLint del componente: correcto.
- Compilación Vite: correcta.
- Copia local compilada: `build-verificacion-visita-desarrollo`.
- La configuración de esa copia apunta exclusivamente a `/backend-dev` y al proyecto `obigqojehfxxgfluygdg`.

## Seguridad

- No se ha utilizado Supabase CLI para desplegar porque la CLI local está enlazada al proyecto de producción `dkkiomutzyvscnqqchqs`.
- No se ha modificado producción.
- No se ha enviado información a ContaSimple.

## Siguiente prueba funcional

1. Iniciar sesión en la aplicación local.
2. Abrir un lead con el presupuesto completo.
3. Resolver todos los controles previos.
4. Pulsar **Emitir presupuesto**.
5. Comprobar el número `PRE-2026-XXXX`, el PDF y la entrada del historial.
6. Editar el borrador y emitir una segunda vez para comprobar la versión `v2`.

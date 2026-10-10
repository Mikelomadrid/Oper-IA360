# Punto de restauración — Revisor de alcance de presupuestos v1

Fecha: 10/10/2026

## Alcance completado

- Se añadió una sección **Revisión del alcance** dentro de `Visita y presupuesto` del lead.
- El revisor contrasta las partidas propuestas y las notas de la visita para señalar trabajos auxiliares o confirmaciones que suelen olvidarse.
- Cada aviso queda marcado como obligatorio, recomendado o pendiente de confirmar.
- La decisión sigue siendo humana: el usuario puede añadir la partida propuesta, convertir la observación en un dato pendiente, descartarla como `No aplica` o recuperar la revisión.
- Las decisiones se conservan con el borrador en `revision_alcance`.

## Reglas iniciales

- Demoliciones: exige prever contenedor, saca o gestión de residuos.
- Trabajos con polvo o riesgo: recomienda protección de la zona de trabajo.
- Referencias a portal, ascensor, rellano, comunidad o finca: recomienda protección de zonas comunes.
- Instalaciones nuevas: recomienda ayudas de albañilería y exige pruebas o puesta en servicio.
- Trabajos húmedos con revestimientos: pregunta por impermeabilización.
- Alicatados, solados y revestimientos: pregunta por el estado y preparación de los soportes.
- Obras con varias fases: recomienda limpieza final.

## Archivos

- `src/components/LeadVisitBudget.jsx`
- `supabase/migrations/20261010103000_revision_alcance_visitas.sql`

## Base de datos de desarrollo

- Proyecto: `obigqojehfxxgfluygdg` — NuevaERP (desarrollo-seguro).
- Migración aplicada correctamente: columna JSONB `revision_alcance` en `public.visitas_presupuesto`, con valor por defecto `[]` y validación de tipo array.
- No se ha tocado producción ni se ha enviado nada a ContaSimple.

## Verificación

- ESLint del componente: correcto.
- Compilación Vite local: correcta.
- Prueba visual con el borrador del lead de desarrollo: 6 comprobaciones cubiertas y 1 sugerencia pendiente.
- Al aceptar `10.2.02 · Limpieza de fin de obra`, la línea se añade una sola vez y queda correctamente en la fase `12 · Pruebas y limpieza final`.
- La interacción usada para verificar no se guardó en la base de datos.

## Próximo paso recomendado

Probar manualmente las decisiones `Añadir partida`, `Añadir a pendientes` y `No aplica` con distintos alcances. Después ampliar las reglas con la futura capa de conocimiento de procesos por oficio.

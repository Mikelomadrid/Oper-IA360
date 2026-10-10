# Mediciones de visita v1 — 2026-10-09

## Alcance

- Cuaderno de mediciones dentro de `LeadVisitBudget`.
- Extraccion de medidas desde la transcripcion mediante `analyze-visit-notes`.
- Alta y correccion manual de medidas.
- Procedencia visible: transcripcion, manual o corregida.
- Revision pendiente/confirmada.
- Traza visible de la formula.
- Calculo determinista en el ERP para suelo, techo, paredes de estancia y pano de pared.
- Regla ORKALED: pintura y alicatado se miden en bruto, sin descontar puertas ni ventanas.

## Persistencia

- Migracion local: `supabase/migrations/20261009200000_mediciones_visita.sql`.
- Columna `public.visitas_presupuesto.mediciones` JSONB aplicada al proyecto de desarrollo `obigqojehfxxgfluygdg`.
- La funcion Edge `analyze-visit-notes` fue actualizada y desplegada en ese mismo proyecto de desarrollo.

## Verificacion

- ESLint del componente: correcto.
- Build aislado: `build-verificacion-visita-desarrollo`.
- Entrada manual guardada y recuperada tras recargar:
  - suelo cocina: 19,14 m2;
  - techo cocina: 19,14 m2;
  - paredes cocina: 47,69 m2 brutos;
  - pared pasillo: 14,558 m2 (formula mostrada como 14,56 m2).
- Prueba de extraccion automatica: cuatro medidas detectadas.
- La IA devolvio inicialmente un resultado aritmetico incorrecto para las paredes; se corrigio el diseño para que el ERP recalcule siempre desde las dimensiones. Prueba posterior: 47,69 m2 correcto.

## Seguridad

- No se modifico produccion.
- La CLI local sigue vinculada a `NuevaERP`; no se utilizo para el despliegue.
- Los cambios remotos se realizaron exclusivamente en el proyecto de desarrollo.

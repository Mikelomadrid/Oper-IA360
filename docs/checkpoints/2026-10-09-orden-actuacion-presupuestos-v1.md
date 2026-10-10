# Punto de restauración — orden de actuación de presupuestos

Fecha: 2026-10-09

## Alcance

- Las partidas de visita se presentan por secuencia real de obra, con 12 fases posibles.
- El capítulo técnico original de cada partida se conserva y se muestra como dato secundario.
- Cada línea permite corregir manualmente su fase de ejecución.
- La fase y su orden se guardan en `visita_presupuesto_partidas`.
- Si el borrador contiene demoliciones y no contiene la partida `11.1.03`, el ERP propone automáticamente un alquiler de contenedor con cantidad inicial 1.
- La regla del contenedor está duplicada deliberadamente en la instrucción de IA y en una comprobación determinista del frontend.

## Secuencia acordada

1. Protecciones y tapado.
2. Contenedor y residuos.
3. Demoliciones y desmontajes.
4. Albañilería y preparación de soportes.
5. Instalaciones.
6. Cerramientos, tabiques y falsos techos.
7. Impermeabilización y nivelación.
8. Revestimientos, alicatados y solados.
9. Carpintería y equipamiento.
10. Pintura y acabados.
11. Aparatos y remates.
12. Pruebas, repasos y limpieza final.

## Archivos

- `src/components/LeadVisitBudget.jsx`
- `supabase/functions/analyze-visit-notes/index.ts`
- `supabase/migrations/20261009233000_orden_ejecucion_presupuesto.sql`

## Aplicación y pruebas

- Migración aplicada únicamente al proyecto Supabase de desarrollo `obigqojehfxxgfluygdg`.
- Compilación validada con Vite en `build-verificacion-visita-desarrollo`.
- ESLint del componente sin errores.
- Revisión en navegador: 20 líneas, partida `11.1.03` presente una vez y situada entre protecciones y demoliciones.
- No se guardó el borrador durante la prueba, no se envió nada a ContaSimple y no se modificó producción.

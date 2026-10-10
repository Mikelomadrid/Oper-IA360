# Punto de restauración: navegación del control previo al presupuesto

Fecha: 2026-10-10

## Alcance

- Se añadieron botones `Revisar` a los controles pendientes del borrador de presupuesto.
- Cada botón desplaza la pantalla hasta la primera incidencia relacionada:
  - partida sin cantidad;
  - partida con precio o componentes pendientes;
  - revisión de alcance pendiente;
  - primer dato pendiente de confirmar.
- Se añadieron identificadores de navegación a partidas propuestas, líneas del presupuesto, mediciones, revisión de alcance y datos pendientes.
- El desplazamiento es suave y centra la incidencia para poder corregirla directamente.

## Verificación

- `npx eslint src/components/LeadVisitBudget.jsx --quiet`: correcto.
- `npx vite build --outDir build-verificacion-visita-desarrollo`: correcto.
- Validación visual en el ERP local de desarrollo: correctos los cuatro accesos `Revisar`.
- La compilación local se dejó conectada exclusivamente al proxy de Supabase de desarrollo `obigqojehfxxgfluygdg`.

## Seguridad

- No se modificó producción.
- No se enviaron datos a ContaSimple.
- No se creó ninguna obra ni presupuesto real.


# Punto de restauración — estados de decisiones de visita v1

Fecha: 2026-10-11

## Cambio realizado

Los datos por confirmar dejan de eliminarse para desbloquear el presupuesto. Cada decisión conserva su texto y admite tres estados:

- `pendiente`: bloquea la emisión si contiene texto.
- `confirmado`: conserva la decisión y permite emitir.
- `no_aplica`: conserva la decisión y permite emitir.

Los borradores antiguos que contienen una lista simple de textos se convierten automáticamente en decisiones pendientes al cargarse.

## Interfaz

- Resumen visible de pendientes, confirmados y no aplicables.
- Semántica ámbar, verde y gris respectivamente.
- El aviso explica que solo los elementos pendientes bloquean la emisión.
- Se elimina la papelera de esta sección para mantener la trazabilidad.

## Validación

- ESLint del componente: correcto.
- Compilación Vite: correcta.
- Prueba local de los tres controles: correcta.
- El botón **Emitir presupuesto** se habilita cuando no quedan decisiones pendientes con texto.
- Conexión limitada al Supabase de desarrollo `obigqojehfxxgfluygdg`.

Archivo modificado:

- `src/components/LeadVisitBudget.jsx`

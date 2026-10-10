# Punto de restauración — editor de precios del presupuesto v2

Fecha: 2026-10-10

## Alcance terminado

- Se mantiene el editor existente de precio unitario por partida.
- Se mantienen los desgloses por componentes para partidas con varios tipos de precio.
- Cada partida muestra ahora un estado comercial explícito: `Pendiente`, `Parcial` o `Valorada`.
- La cabecera del presupuesto incorpora `Valorar siguiente pendiente`.
- La acción localiza la primera partida incluida con precio incompleto, desplaza la vista y enfoca directamente su campo de precio.
- Al completar una partida, la siguiente pulsación avanza a la siguiente pendiente.
- Los subtotales por fase, base, gastos generales, margen, IVA y total se recalculan con el estado React existente.

## Validación

- ESLint del componente finalizado sin errores.
- Compilación Vite finalizada correctamente.
- Compilación local restaurada contra Supabase de desarrollo `obigqojehfxxgfluygdg` mediante `/backend-dev`.
- Producción y ContaSimple no se han modificado.

## Prueba manual pendiente

La sesión local del navegador había caducado después de recompilar. Para la comprobación visual interactiva solo es necesario iniciar sesión de nuevo con la cuenta de pruebas y abrir `Visita y presupuesto`.


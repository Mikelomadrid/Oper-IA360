# Punto de restauración · Desglose de precio por componentes v1

Fecha: 2026-10-09

## Alcance

- Las partidas compuestas pueden valorarse mediante varios componentes.
- Cada componente dispone de concepto, cantidad, unidad y precio unitario.
- El importe de la partida es la suma de sus componentes activos.
- Los componentes con cantidad cero no suman y no cuentan como precio pendiente.
- Se pueden añadir y eliminar componentes desde cualquier partida del presupuesto interno.
- Se mantiene la medición vinculada y el texto de origen de la partida principal.

## Caso inicial

Partida `1.7.15 · Línea nueva de fuerza`:

- 4 ud · Línea eléctrica con conductores de 2,5 mm².
- 1 ud · Línea para vitrocerámica con conductores de 4 mm².
- 0 ud · Línea compartida de vitrocerámica y horno con conductores de 6 mm², marcada como alternativa.

La cantidad cero permite conservar la opción de 6 mm² sin sumarla mientras vitrocerámica y horno se ejecuten con líneas independientes.

## Base de datos de desarrollo

Proyecto: `obigqojehfxxgfluygdg` (`NuevaERP (desarrollo-seguro)`)

Migración aplicada:

- `supabase/migrations/20261009220000_desglose_precio_partidas_visita.sql`
- Añade `visita_presupuesto_partidas.desglose_precio jsonb`.
- Verifica que el valor almacenado sea un array JSON.
- Inicializa los tres componentes de la partida `1.7.15` existente.

## Verificación

- ESLint: correcto.
- Compilación Vite: correcta.
- Migración aplicada en desarrollo: correcta.
- Consulta SQL: los tres componentes están guardados en la partida `1.7.15`.
- Prueba temporal de cálculo: `4 × 100 € + 1 × 200 € = 600 €`.
- Los precios de prueba se restauraron en blanco y no se guardaron.
- La alternativa de 6 mm² permanece a cantidad cero y su precio queda deshabilitado.
- Consola del navegador: sin errores.
- Producción y ContaSimple: sin cambios.

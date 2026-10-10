# Punto de restauración · Presupuesto interno por capítulos v1

Fecha: 2026-10-09

## Alcance

- Se mantiene una única fuente de datos: el borrador de visita del lead.
- Las partidas se agrupan visualmente por capítulo sin duplicarlas en `obras_partidas`.
- Cada línea admite un precio unitario introducido manualmente.
- La cantidad conserva su vínculo con el cuaderno de mediciones y su texto de origen.
- Se calculan subtotal por capítulo y base provisional del presupuesto.
- Una partida puede marcarse como `No incluir` sin eliminarla ni perder su trazabilidad.
- Los precios históricos y los precios de referencia de la biblioteca no se copian automáticamente.
- El borrador no crea una obra y no se envía a ContaSimple.

## Base de datos de desarrollo

Proyecto: `obigqojehfxxgfluygdg` (`NuevaERP (desarrollo-seguro)`)

Migración aplicada:

- `supabase/migrations/20261009210000_valoracion_presupuesto_visita.sql`
- Añade `visita_presupuesto_partidas.precio_unitario numeric(14,4)` anulable.
- `NULL` representa una partida pendiente de valorar.
- Se valida que un precio informado no sea negativo.

## Archivos principales

- `src/components/LeadVisitBudget.jsx`
- `supabase/migrations/20261009210000_valoracion_presupuesto_visita.sql`

## Verificación

- ESLint del componente: correcto.
- Compilación Vite: correcta.
- Migración SQL en desarrollo: `Success. No rows returned`.
- Pantalla local: 7 capítulos, 19 partidas incluidas, 19 precios pendientes.
- Prueba de cálculo temporal: 4 ud × 10,00 € = 40,00 €; después se restauró el precio en blanco.
- Guardado real del borrador: confirmado por la aplicación.
- Consola del navegador tras guardar: sin errores.
- Configuración local restaurada contra `/backend-dev`; producción no se modificó.

## Siguiente paso recomendado

Permitir revisar y completar cantidades aún pendientes, y después definir gastos generales, margen e IVA antes de generar una versión imprimible o sincronizable.

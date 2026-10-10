# Punto de restauración — mediciones vinculadas a partidas

Fecha: 2026-10-09

Entorno afectado: únicamente desarrollo (`obigqojehfxxgfluygdg`).

## Resultado

- Cada partida de visita puede guardar `medicion_id` y tomar de esa medición su cantidad y unidad.
- Una misma medición puede alimentar varias partidas sin duplicar la entrada manual.
- Las cantidades y unidades vinculadas quedan bloqueadas; para editarlas directamente hay que desvincular la partida.
- Al corregir una medición se actualizan en memoria todas sus partidas vinculadas.
- Cada medición muestra cuántas partidas la utilizan y cada partida muestra la traza de la medición de origen.
- Si se elimina una medición, sus partidas quedan desvinculadas conservando la última cantidad visible.
- Al cargar un borrador se recuperan los snapshots de código y capítulo y, si un borrador antiguo los tenía vacíos, se reconstruyen desde su partida vinculada de la biblioteca.

## Migración aplicada en desarrollo

`supabase/migrations/20261009201000_vincular_mediciones_partidas.sql`

Añade de forma aditiva `medicion_id text` a `visita_presupuesto_partidas`, junto con un índice parcial por visita y medición.

## Vínculos de la prueba real

- M-01 Cocina · Suelo · 19,14 m² → Solado porcelánico y Solera de nivelación.
- M-02 Cocina · Techo · 19,14 m² → Falso techo continuo de pladur.
- M-03 Cocina · Paredes · 47,69 m² → Alicatado porcelánico.
- M-04 Pasillo · Paño de pared · 14,56 m² → Pintura plástica.

## Verificación

- ESLint del componente: correcto.
- Build Vite del paquete de pruebas: correcto.
- Migración SQL: `Success. No rows returned`.
- Consulta de control final: 5 partidas vinculadas, 4 mediciones utilizadas y 19/19 códigos snapshot conservados; M-01 queda compartida por dos partidas.
- No se ha desplegado ni alterado producción.

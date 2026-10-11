# Punto de restauración — Producción y rendimientos V1

Fecha: 2026-10-09

## Objetivo

Registrar mediciones reales de las partidas ejecutadas en cada obra para construir históricos de rendimiento, sin modificar contabilidad ni enviar datos a Contasimple.

## Cambios realizados

- Nuevo componente `src/components/ProjectProductionView.jsx`.
- Nueva pestaña `Producción` dentro del grupo `Costes` de la ficha de obra.
- Consulta de la biblioteca `sistemas_rendimiento` y de sus costes de referencia.
- Registro en `obra_sistema_mediciones` con:
  - partida;
  - fecha;
  - zona;
  - cantidad ejecutada y unidad;
  - observaciones;
  - fotografía de los costes de referencia vigentes.
- Resumen acumulado por partida.
- Historial cronológico de mediciones.
- Estados de carga, vacío y error.
- Acceso de escritura limitado por la lógica existente a administrador y encargado.
- Selector de partidas corregido para usar directamente el identificador de cada opción, sin depender de comparar la descripción visible.

## Seguridad funcional

- No genera movimientos de almacén.
- No modifica gastos ni facturas.
- No se conecta con Contasimple.
- No se han creado registros de prueba durante la validación visual.

## Validación

- ESLint sin errores ni avisos en los archivos modificados.
- `npm run build` completado correctamente.
- Pantalla verificada en la obra de desarrollo `[PRUEBA IA360] Obra retrasada` mediante la ruta `?tab=produccion`.

## Próxima fase

Tras validar la captura básica con el usuario:

1. Asociar horas reales de trabajadores a cada medición.
2. Asociar consumos reales procedentes de compras y salidas de almacén.
3. Calcular rendimiento real por unidad y compararlo con la referencia de la biblioteca.

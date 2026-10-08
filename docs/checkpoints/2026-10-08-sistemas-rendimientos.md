# Punto de restauración — sistemas y rendimientos

Fecha: 2026-10-08

## Objetivo

Crear una biblioteca técnica que permita medir desde ahora consumos y rendimientos reales por unidad de trabajo, incluyendo materiales, mano de obra propia y otros costes directos.

## Implementado

- Nueva ruta administrativa: `/inventario/rendimientos`.
- Acceso `SISTEMAS Y RENDIMIENTOS` dentro de Inventario para `admin` y `encargado`.
- Fichas por unidad base (`m²`, `ml`, `m³`, `ud`, etc.).
- Desglose de materiales con cantidad, unidad, merma y precio de referencia.
- Desglose de mano de obra con oficio, horas por unidad y coste horario congelado.
- Desglose separado de maquinaria, transporte y subcontrata.
- Cálculo de coste directo por unidad.
- Estados `borrador`, `validado` e `inactivo`.
- Creación de nuevas revisiones sin reescribir el histórico.
- Bloqueo de validación de fichas sin ningún recurso.
- Modelo preparado para registrar mediciones reales de obra y comparar previsto frente a ejecutado.

## Base de datos

Migración: `supabase/migrations/20261009010000_sistemas_rendimiento_library.sql`

Aplicada correctamente en Supabase de desarrollo:

- Proyecto: `NuevaERP / desarrollo-seguro`
- Referencia: `obigqojehfxxgfluygdg`
- Resultado del editor SQL: `Success. No rows returned`

No se ha utilizado la CLI para desplegar porque su vínculo local apunta a otro proyecto (`dkkiomutzyvscnqqchqs`).

## Prueba funcional

Creada una ficha real de aprendizaje:

- Código: `PLA-TAB-001`
- Nombre: `Tabique de pladur — medición inicial`
- Unidad: `m²`
- Estado: `borrador`
- Sin consumos ni costes inventados.

## Referencias estudiadas

- ERPNext: patrón de materiales + operaciones, costes por unidad y datos históricos.
- BuildSuite Core: biblioteca de tarifas, BOQ, mediciones y costes reales por obra.
- RAB Maker: plantillas reutilizables de costes de material y mano de obra.

Decisión: adaptar los conceptos al ERP existente; no incorporar código o dependencias externas.

## Siguiente paso recomendado

Completar `PLA-TAB-001` durante una ejecución real:

1. Registrar cantidades compradas o salidas de almacén.
2. Registrar superficie realmente ejecutada.
3. Asociar horas reales de los fichajes a ese sistema y zona.
4. Calcular consumo y horas por m².
5. Validar la primera versión cuando exista una muestra suficiente.

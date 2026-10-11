# Punto de restauración: biblioteca maestra de partidas

Fecha: 2026-10-09

## Estado alcanzado

- Se ha tomado como base maestra el Excel revisado por el usuario.
- Copia conservada en `docs/biblioteca-partidas/biblioteca_partidas_maestra.xlsx`.
- Se han importado 212 partidas nuevas en el proyecto Supabase de desarrollo.
- La biblioteca de desarrollo contiene 213 registros en total: las 212 partidas importadas y la partida de aprendizaje previa `PLA-TAB-001`.
- Las partidas importadas permanecen en estado `borrador`; no se han validado automáticamente.
- No se ha importado ningún precio histórico.
- No se ha modificado el entorno de producción.

## Cambios técnicos

- Interfaz actualizada: `src/components/BibliotecaRendimientos.jsx`.
- Generador reproducible: `scripts/generar_seed_biblioteca_partidas.mjs`.
- Importador opcional por terminal: `scripts/importar_biblioteca_partidas_desarrollo.mjs`.
- Migración generada: `supabase/migrations/20261009140000_importar_biblioteca_partidas_maestra.sql`.
- Nuevos metadatos en `sistemas_rendimiento`: `capitulo`, `categoria_detalle`, `grupo` y `origen`.
- Filtros añadidos por capítulo y categoría.
- Importación desde Excel preparada para insertar solo códigos que todavía no existan.

## Verificación

- Importación confirmada desde el ERP: 212 nuevas y 0 existentes.
- ESLint del componente: correcto.
- Compilación de producción: correcta.
- `git diff --check`: correcto.

## Siguiente paso recomendado

La edición de partidas ya está habilitada desde la ficha de detalle:

- Se pueden corregir nombre, familia, unidad, capítulo, categoría, grupo, merma y descripción.
- El código queda bloqueado como referencia estable.
- Las partidas validadas no se pueden editar directamente; requieren una nueva revisión.
- Si la partida ya tiene recursos, el formulario avisa de que un cambio de unidad no convierte automáticamente cantidades ni horas.
- El guardado se verificó en desarrollo con la partida `4.1.01`, sin cambiar su contenido.

Siguiente paso: relacionar estas partidas con presupuestos, mediciones, materiales y rendimientos reales.

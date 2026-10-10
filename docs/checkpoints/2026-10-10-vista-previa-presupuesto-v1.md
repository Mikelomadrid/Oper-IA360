# Punto de restauración: vista previa del presupuesto v1

Fecha: 2026-10-10

## Alcance

- Se añadió el acceso `Ver vista previa` desde el control de preparación del presupuesto.
- La vista se presenta como una hoja de presupuesto amplia y legible dentro del ERP.
- Incluye:
  - identidad de ORKALED;
  - referencia y fecha;
  - cliente y emplazamiento del lead;
  - resumen de los trabajos;
  - capítulos según el orden real de ejecución;
  - partidas, cantidades, precios y componentes de precio;
  - subtotal por fase;
  - gastos generales, margen, base imponible, IVA y total.
- Las partidas excluidas no aparecen en el documento.
- Cuando el control previo tiene incidencias, la hoja se marca como `BORRADOR` y muestra un aviso final con el número de grupos pendientes.
- La vista puede cerrarse y abrirse sin modificar el borrador.

## Revisión de cabecera y objeto

- La cabecera del documento muestra ahora tres bloques diferenciados:
  - cliente: persona, empresa y CIF/NIF;
  - contacto: teléfono y correo electrónico;
  - emplazamiento: dirección, código postal y municipio.
- El objeto del presupuesto deja de reutilizar el resumen técnico completo.
- Se añadió un campo breve, editable y limitado a 220 caracteres, guardado en `visitas_presupuesto.objeto_presupuesto`.
- Cuando un borrador antiguo no tiene objeto breve, se propone automáticamente una versión reducida a partir del resumen existente.
- En el lead de desarrollo el resultado validado es: `Reforma integral de cocina.`
- Se añadió el campo manual `Notas o indicaciones de cabecera`:
  - es opcional, multilínea y admite hasta 1.200 caracteres;
  - respeta los saltos de línea;
  - aparece después del objeto y antes de las partidas;
  - se guarda en `visitas_presupuesto.notas_cabecera_presupuesto`.
- Todos los presupuestos muestran siempre al pie dos bloques fijos:
  - condiciones del alcance, indicando que únicamente se ejecutarán los trabajos presupuestados y que los cambios del cliente, vicios ocultos o partidas no valoradas se presupuestarán aparte;
  - forma de pago: 50 % a la aceptación y reserva de fecha, 25 % a mitad de ejecución y 25 % a la finalización.

## Integración

- `LeadDetail` entrega a la vista los datos ya cargados del lead, evitando una consulta duplicada.
- Migración aplicada en desarrollo: `supabase/migrations/20261010160000_objeto_breve_presupuesto.sql`.
- Migración aplicada en desarrollo: `supabase/migrations/20261010170000_notas_cabecera_presupuesto.sql`.
- No se crea ningún presupuesto externo ni se envía información a ContaSimple.

## Verificación

- ESLint correcto en `LeadVisitBudget.jsx` y `LeadDetail.jsx`.
- Compilación Vite local correcta.
- Probada con el lead exclusivo de desarrollo.
- Se verificaron cabecera, capítulos, líneas, desgloses, totales y aviso de documento incompleto.
- Se verificó una nota de cabecera con dos líneas, su visualización y su persistencia tras recargar; después se eliminó el contenido de prueba.
- Se verificó la presencia permanente y la redacción final de las condiciones y de los tres hitos de pago.
- El ejemplo actual muestra cuatro grupos de revisión pendientes y se identifica correctamente como borrador.

## Seguridad

- No se modificó producción.
- No se creó ninguna obra.
- No se emitió ni sincronizó ningún presupuesto.

## Próximo paso recomendado

Añadir la generación imprimible/PDF y una acción de versión definitiva que solo se habilite cuando el control previo esté completo.


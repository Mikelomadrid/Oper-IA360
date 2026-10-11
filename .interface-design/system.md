# Sistema de interfaz — ORKALED ERP

## Dirección

Interfaz operativa para responsables de obra y administración. Debe permitir revisar, decidir y ejecutar con rapidez, conservando siempre la trazabilidad. El tono es técnico, sereno y directo; no decorativo.

## Dominio visual

- Visita y replanteo.
- Alcance y partidas.
- Decisiones pendientes.
- Emisión, versión e historial.
- Costes, mediciones y trazabilidad.

## Paleta semántica

- Violeta ORKALED: identidad y acciones principales.
- Ámbar: dato pendiente que requiere actuación.
- Verde: confirmado, emitido o completado.
- Gris pizarra: no aplicable, histórico o secundario.
- Rojo: error, anulación o acción destructiva real.
- Blanco y piedra clara: documento, superficie de trabajo y fondo.

El color comunica estado; no se utiliza como decoración.

## Profundidad y superficies

- Estrategia principal: bordes suaves y cambios leves de superficie.
- Sombras discretas únicamente cuando una tarjeta debe separarse del documento o del fondo.
- Los controles de entrada se muestran como elementos ligeramente insertados.
- Radios moderados: pequeños en controles, medios en tarjetas y diálogos.

## Tipografía

- Mantener la familia tipográfica actual del ERP.
- Jerarquía por peso, tamaño y espaciado, no solo por tamaño.
- Referencias, importes y numeraciones con tipografía monoespaciada y cifras tabulares.
- Etiquetas operativas pequeñas, con peso medio y espaciado contenido.

## Espaciado

- Unidad base: 4 px.
- Microespacios: 4–8 px.
- Interior de controles y filas: 8–12 px.
- Interior de tarjetas: 16–24 px.
- Separación entre secciones: 20–32 px.

## Patrones reutilizables

### Decisiones de visita

Cada duda conserva su texto y admite tres estados:

- Pendiente: ámbar; bloquea la acción final.
- Confirmado: verde; conserva la decisión y desbloquea.
- No aplica: gris; conserva la decisión y desbloquea.

Nunca utilizar la eliminación como única forma de resolver una decisión. Mostrar un resumen de estados y explicar qué estado bloquea el flujo.

### Emisión de documentos

- Separar claramente borrador editable y emisión inmutable.
- Mostrar número y versión en formato monoespaciado.
- La acción de emitir utiliza verde y exige comprobaciones previas.
- Conservar un historial visible de versiones con fecha, estado e importes.
- El borrador posterior a una emisión debe identificarse como la siguiente versión potencial.

### Revisiones previas

- Cada bloqueo debe explicar la causa y ofrecer una acción “Revisar”.
- El usuario debe llegar directamente al primer elemento que requiere decisión.
- No habilitar la acción final mientras existan bloqueos reales.

### Partidas de obra y avance

- Cada partida contractual muestra previsto, ejecutado, pendiente y porcentaje de avance.
- La línea de progreso es el elemento principal: violeta en curso, verde completado y ámbar cuando existe exceso.
- Los valores se presentan con cifras tabulares; la descripción conserva la mayor anchura disponible.
- El registro de producción parte siempre de una partida de la obra, nunca de la biblioteca completa.
- Las partidas sin vínculo técnico permanecen visibles, pero explican por qué todavía no permiten registrar producción.

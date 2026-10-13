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

### Creación de tareas con trazabilidad

- Toda tarea operativa nace vinculada a una partida de la misma obra; nunca se elige desde la biblioteca general.
- La partida aporta código, descripción, capítulo, zona, cantidad y unidad. El encargado puede ajustar la cantidad prevista sin perder el vínculo contractual.
- Una partida solo puede tener una tarea activa asociada. Las partidas ya utilizadas permanecen visibles, pero deshabilitadas y rotuladas como “ya tiene tarea”.
- El título operativo debe ser corto y reconocible desde el móvil; la descripción contractual y las indicaciones para el equipo se conservan en campos separados.
- Los estados vacíos distinguen entre una obra sin partidas y una obra cuyas partidas ya están completamente convertidas en tareas, indicando la siguiente acción correcta.

### Bandeja de trabajo del técnico

- Solo existe mientras hay un fichaje abierto en una obra y muestra exclusivamente las tareas del empleado autenticado en esa obra.
- Orden visual fijo: realizadas, en curso y pendientes; las pendientes conservan el orden de actuación definido por el encargado.
- El listado usa filas compactas de una sola línea con orden, título recortado, obra y estado. La descripción completa, las indicaciones y las subtareas solo aparecen al pulsar la tarea.
- La tarea en curso concentra la acción principal. Finalizar exige al menos una fotografía y activa automáticamente la siguiente tarea disponible.
- Las tareas realizadas permanecen visibles en verde como confirmación; el técnico nunca accede al cronograma completo ni al trabajo de otros empleados.
- Las fotografías se presentan dentro de la carpeta diaria del empleado y muestran únicamente fecha y hora de subida como metadatos visibles.

### Bandeja de tareas del encargado

- Reutiliza el mismo listado compacto y el mismo orden visual que la bandeja del técnico: realizadas, en curso y pendientes.
- Añade el nombre del empleado asignado y conserva el acceso a edición; la cuadrícula de tarjetas queda como vista alternativa, no como vista inicial.
- Las tareas pendientes de validación aparecen en un bloque ámbar separado, antes del listado operativo, para que no se confundan con trabajos ya aprobados.
- La revisión sigue un orden fijo: evidencia fotográfica, responsable y horas previstas/reales, descripción del trabajo y decisión final.
- Aprobar utiliza verde y exige al menos una fotografía. Devolver para corregir utiliza ámbar, exige un comentario y reabre la tarea para el equipo.

### Rendimiento observado de empleados y equipos

- Sustituye las habilidades declaradas manualmente por muestras procedentes exclusivamente de tareas medidas y aprobadas.
- La información se agrupa primero por oficio y después por partida; cada partida compara empleado, equipo exacto y media global.
- Las combinaciones de trabajadores se consideran equipos distintos y se muestran solo por sus nombres, sin etiquetas de cargo.
- Violeta identifica el dato individual, verde una diferencia positiva y ámbar una diferencia negativa o una muestra todavía insuficiente.
- Esta información solo se muestra a encargado y administración; el estado vacío explica cómo se generarán los primeros datos reales.

### Modo visita de mediciones

- El flujo se diseña primero para móvil y evita formularios largos: seleccionar estancia, capturar Medida A y Medida B y continuar.
- La altura general se indica una sola vez y se hereda en todas las estancias, con posibilidad de sustituirla puntualmente.
- Medida A y Medida B se normalizan automáticamente: la mayor se guarda como largo y la menor como ancho.
- El catálogo muestra primero los espacios habituales del tipo de inmueble y mantiene “Otro espacio” siempre disponible para nombres no previstos.
- Las estancias repetidas se numeran automáticamente. Se permite duplicar solo la estructura o también sus mediciones.
- Cada valor conserva en el borrador su procedencia manual o GLM; el violeta identifica la captura activa y el verde una estancia completa.
- El resumen calcula suelo/techo, paredes y rodapié sin descontar puertas ni ventanas, según el criterio operativo de ORKALED.
- El borrador se conserva en el dispositivo para proteger la visita ante cierres o pérdidas de conexión.

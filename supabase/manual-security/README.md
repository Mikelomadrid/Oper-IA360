# Refuerzos manuales de seguridad IA360

Estos archivos documentan cambios aplicados exclusivamente a la rama Supabase `desarrollo-seguro` (`obigqojehfxxgfluygdg`). No deben ejecutarse directamente en producción sin una revisión y una ventana de despliegue específica.

## Cierre seguro de partes — 7 de octubre de 2026

Archivos:

- `refuerzo-api-parte-cerrar-ia360.sql`
- `prueba-transaccional-api-parte-cerrar-ia360.sql`
- `verificacion-api-parte-cerrar.png`

Cambios aplicados:

- `api_parte_cerrar(...)` valida el empleado autenticado, su estado activo y que no sea de solo lectura.
- Solo pueden cerrar el parte administración/encargado, el técnico asignado o el administrador de finca relacionado.
- Se bloquean partes inexistentes, eliminados o que ya estén en un estado cerrado.
- Se validan descripción, cliente, firma y pertenencia de las evidencias al parte.
- El parte se bloquea con `FOR UPDATE` durante el cierre para evitar cierres simultáneos.
- Las referencias de evidencias y la bitácora se registran en la misma transacción que el cierre.
- Se retiró `EXECUTE` a `PUBLIC` y `anon`; solo `authenticated` conserva ejecución.
- `ParteDetail.jsx` limita el botón a roles autorizados y elimina archivos recién subidos si el RPC falla.

Verificación realizada:

- compilación Vite correcta en `build-verificacion-parte-cerrar`;
- ESLint correcto para `src/components/ParteDetail.jsx`;
- cierre permitido al técnico ficticio asignado;
- cierre bloqueado al colaborador ficticio no asignado;
- prueba terminada con `ROLLBACK`;
- estado del parte ficticio restaurado a `nuevo`;
- `residuos_temporales=0`;
- controles finales de permisos, asignación, bloqueo de fila y evidencias: todos `true`.

## Limitación del entorno de desarrollo — resuelta el 7 de octubre de 2026

La configuración del bucket `partes-data` y sus políticas se replicó de manera controlada en la rama `desarrollo-seguro`, sin copiar archivos reales de producción. Después se completó una prueba visual de extremo a extremo con un parte, usuario, cliente, material, fotografía y firma totalmente ficticios.

## Storage privado de partes — aplicado el 7 de octubre de 2026

Archivos:

- `configurar-storage-partes-data-desarrollo-ia360.sql`
- `verificar-storage-partes-data-desarrollo-ia360.sql`
- `prueba-transaccional-storage-partes-data-ia360.sql`
- `verificacion-storage-partes-data-2026-10-07.png`
- `verificacion-rls-storage-partes-data-2026-10-07.png`
- `prueba_api_marker_20261007.png`
- `verificacion-subida-storage-partes-data-2026-10-07.png`
- `verificacion-eliminacion-storage-partes-data-2026-10-07.png`

El script crea o actualiza un bucket privado y vacío llamado `partes-data`, con límite de 20 MiB y tipos compatibles con la interfaz actual: imágenes, PDF, Word y Excel. No copia archivos de producción.

Las políticas contemplan los tres formatos de ruta usados por el ERP (`archivos/{parteId}/...`, `firmas/{parteId}/...` y el formato histórico `{parteId}/...`) y solo permiten acceso a empleados activos relacionados con el parte: administración/encargado, técnico asignado o administrador de finca vinculado/creador. Las escrituras también se bloquean para perfiles de solo lectura y no se permite acceder a partes eliminados.

La verificación inicial consultó únicamente metadatos del bucket, funciones y políticas. La prueba física posterior se realizó por separado, con confirmación específica y usando exclusivamente un archivo ficticio.

Aplicación y verificación realizadas exclusivamente en `NuevaERP / desarrollo-seguro Preview` (`obigqojehfxxgfluygdg`):

- creación/actualización del bucket finalizada con `Success. No rows returned`;
- bucket existente, privado y limitado a 20 MiB;
- imágenes y PDF admitidos (además de Word y Excel configurados por el script);
- políticas `SELECT`, `INSERT`, `UPDATE` y `DELETE` presentes;
- las cuatro políticas concedidas únicamente a `authenticated`;
- funciones de extracción de ruta y autorización presentes;
- formatos `archivos/{parteId}/...`, `firmas/{parteId}/...` y `{parteId}/...` reconocidos;
- resultado agregado de los 15 controles: `todos_controles_ok = true`.

Durante la configuración inicial no se copiaron ni subieron archivos y producción no fue modificada. La prueba física descrita a continuación se hizo después y terminó eliminando su objeto temporal.

La prueba transaccional de autorización comprobó `INSERT`, `SELECT` y `UPDATE` de `storage.objects` con el técnico ficticio asignado, y bloqueó al colaborador ficticio ajeno. Usa únicamente metadatos temporales y finaliza con `ROLLBACK`. Supabase protege sus tablas internas frente al `DELETE` SQL directo, por lo que el borrado físico debe probarse mediante la API de Storage durante la prueba end-to-end.

Resultados:

- `rollback_sin_residuos = true`;
- `tecnico_insert_select_update_permitido = true`;
- `colaborador_ajeno_bloqueado = true`.

Un primer intento confirmó además que `storage.protect_delete()` impide correctamente el borrado SQL directo. La transacción se abortó y una consulta independiente verificó `residuos_storage = 0` antes de ejecutar la versión adaptada.

Prueba física de Storage:

- se utilizó únicamente el icono genérico local `prueba_api_marker_20261007.png` (1.466 bytes);
- se subió a `partes-data/archivos/10000000-0000-4000-8000-000000000005/prueba_api_marker_20261007.png`;
- el panel confirmó la presencia del archivo en `desarrollo-seguro Preview`;
- el archivo se eliminó mediante la interfaz/API de Storage;
- la carpeta del parte quedó sin archivos;
- no se copiaron documentos ni imágenes reales de producción.

## Prueba integral del flujo de partes — 7 de octubre de 2026

Parte ficticio utilizado:

- referencia `PRUEBA-IA360-001`;
- cliente `[PRUEBA IA360] Cliente ficticio`;
- técnico `Técnico Pruebas IA360`;
- ningún dato, archivo o credencial real se añadió al escenario de prueba.

Resultados verificados:

- acceso del técnico ficticio al parte asignado;
- fichaje de entrada y salida;
- transición automática de `NUEVO` a `VISITADO`;
- subida desde el ERP del archivo genérico `prueba_api_marker_20261007.png`;
- persistencia del registro en `partes_archivos` y visualización como `Galería (1)`;
- descripción de resolución y firma ficticia obligatoria;
- cierre mediante `api_parte_cerrar(...)`;
- persistencia final del estado `REALIZADO` tras recargar la aplicación;
- registro de cierre en la bitácora y aparición de la fotografía en el anexo de evidencias;
- producción no modificada.

Correcciones necesarias detectadas durante la prueba:

- permisos `SELECT`, `INSERT` y `DELETE` para `authenticated` sobre `partes_archivos`, manteniendo las restricciones de las políticas RLS;
- permisos de consulta para `v_partes_estado_ui` y de uso para `usuario_alertas_vistas`;
- comprobación explícita del error al insertar el metadato de una foto después de subirla a Storage;
- eliminación automática del objeto recién subido si falla el registro en base de datos, evitando falsos mensajes de éxito y archivos huérfanos.

Evidencias principales:

- `verificacion-login-tecnico-2026-10-07.png`;
- `flujo-parte-fotos-listo-2026-10-07.png`;
- `verificacion-subida-erp-parte-2026-10-07.png`;
- `verificacion-cierre-parte-2026-10-07.png`.

## Notificaciones externas en desarrollo

La prueba de cierre detectó que `notify-technician` no dispone de los secretos `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` en `desarrollo-seguro`. El error de Meta no afectó al cierre del parte.

Para evitar envíos reales o intentos con credenciales inexistentes, el frontend omite por defecto las notificaciones externas durante el desarrollo. Producción conserva su comportamiento y las pruebas de WhatsApp solo podrán activarse expresamente con `VITE_ENABLE_EXTERNAL_NOTIFICATIONS=true` y credenciales exclusivas de prueba.

## Centro de Control IA360 — verificado el 7 de octubre de 2026

Se habilitó y probó el radar operativo de solo lectura con el usuario ficticio `pruebas.erp@orkaled.invalid`, vinculado exclusivamente a la rama `desarrollo-seguro` y configurado como administrador.

Durante la primera carga se detectó que `public.gastos` tenía políticas RLS adecuadas, pero no el privilegio base `SELECT` para el rol `authenticated`. Se aplicó `habilitar-lectura-gastos-control-ia360-desarrollo.sql`; la comprobación `has_table_privilege(...)` devolvió `true`. Las políticas RLS continúan limitando las filas visibles según el usuario autenticado.

Resultados verificados:

- acceso a `/control-ia` permitido al administrador ficticio;
- enlace `CONTROL IA360` visible en el menú;
- radar cargado sin escrituras ni decisiones automáticas;
- el botón de actualización muestra estado de carga, confirmación y hora con segundos;
- carriles `Urgente hoy`, `Próximos 7 días` y `Sin seguimiento` visibles;
- tarea ficticia `[PRUEBA IA360] Revisar mediciones` detectada en `Próximos 7 días`;
- las alertas de tareas navegan con `focus` y abren directamente la tarea seleccionada;
- las tareas activas sin responsable se clasifican en `Sin seguimiento`;
- `public.subtareas` dispone de `SELECT` para `authenticated` con RLS activo, documentado en `habilitar-lectura-subtareas-control-ia360-desarrollo.sql`;
- producción no modificada.

### Escenario completo del radar

El archivo `escenario-radar-control-ia360-desarrollo.sql` deja preparado un conjunto repetible y completamente ficticio. El archivo `limpiar-escenario-radar-control-ia360-desarrollo.sql` permite retirarlo más adelante con confirmación explícita.

Resultado visual comprobado:

- `7` asuntos totales;
- `3` urgentes: factura vencida, obra retrasada y tarea vencida;
- `1` próximo: tarea con vencimiento dentro de siete días;
- `3` sin seguimiento: lead inactivo, parte sin visita y tarea sin responsable;
- los seis tipos de enlace probados conducen a gastos, detalle de obra, tarea enfocada, detalle de lead, detalle de parte y tarea sin responsable;
- los intentos previos que fallaron por sintaxis o restricción de propietario quedaron abortados antes de confirmar la transacción y no generaron registros parciales.


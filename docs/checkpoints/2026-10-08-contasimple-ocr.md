# Punto de restauración: OCR ContaSimple

Fecha: 2026-10-08

## Entorno y alcance

- Proyecto local: `Oper-IA360`
- Supabase de desarrollo: `obigqojehfxxgfluygdg` (`desarrollo-seguro`)
- No se ha tocado producción.
- Factura de prueba autorizada: `MATERIALES VALDELUZ S.L.`, `FV-2026-01847`, `488,72 €`.
- La factura `BRICOLAJE BRICOMAN, S.L.U.`, `012-0009-482908`, no se ha enviado ni modificado.

## Estado guardado

- La función `contasimple-invoice` descarga correctamente el PDF desde el bucket privado.
- El acceso con `service_role` y la validación del usuario funcionan.
- ContaSimple exige una clase contable para el OCR de facturas recibidas.
- Mediante la lectura de facturas reales se confirmó que la clase adecuada para compras de materiales es `600` (`Compras de mercaderías (materiales)`).
- `invoiceClass=600` se envía tanto en el formulario multipart como en la URL, junto con el periodo.
- La última versión fue desplegada correctamente en la Edge Function de desarrollo.
- Commits principales:
  - `9f2ac38` — añade la clase 600 al formulario OCR.
  - `e79fd27` — añade `period` e `invoiceClass` a la URL del endpoint OCR.

## Incidencia pendiente

Los últimos intentos no llegaron a la Edge Function. Al pulsar `Enviar al OCR`, el servidor Vite local perdió la conexión durante aproximadamente un segundo y el navegador devolvió `Failed to send a request to the Edge Function`. Por tanto, esos intentos no crearon una solicitud OCR en ContaSimple.

## Próximo paso

1. Diagnosticar por qué el servidor local `127.0.0.1:3000` se reinicia al pulsar el envío.
2. Confirmar en la bandeja que `FV-2026-01847` sigue `Preparada para enviar`.
3. Pedir confirmación inmediata antes de un nuevo envío real.
4. Si el OCR acepta la petición, guardar el `requestId`, consultar el estado y verificar el documento en ContaSimple.
5. No borrar nada de ContaSimple sin una confirmación separada.

No se guardan claves, tokens ni contraseñas en este documento.

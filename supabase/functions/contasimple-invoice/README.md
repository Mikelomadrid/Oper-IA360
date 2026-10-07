# Envío de facturas recibidas a ContaSimple

Edge Function autenticada para el flujo controlado del ERP:

1. Verifica que el usuario sea `admin` o `encargado` activo.
2. Exige una factura OCR validada y en estado `lista_para_contasimple`.
3. Busca posibles duplicados en ContaSimple por número, NIF e importe.
4. Descarga únicamente documentos del bucket autorizado `facturas_ocr` del mismo proyecto Supabase.
5. Envía el PDF o imagen a `POST /api/v2/ocr/receivedInvoice`.
6. Guarda el `requestId` y permite consultar `GET /api/v2/ocr/{requestId}`.

## Peticiones

```json
{ "action": "upload", "facturaId": "uuid" }
```

```json
{ "action": "status", "facturaId": "uuid" }
```

## Configuración

El secreto `CONTASIMPLE_API_KEY` debe existir en los secretos de Edge Functions.
No debe copiarse al frontend, al repositorio ni a los registros.

La función usa además los secretos administrados por Supabase:
`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

## Seguridad operativa

- No realiza envíos automáticos: el usuario confirma cada factura en la bandeja.
- No permite repetir un envío cuando ya existe un identificador OCR o documento.
- El límite de archivo es 20 MB.
- Formatos permitidos: PDF, JPEG, PNG y WebP.
- Desplegar y probar primero únicamente en el proyecto Supabase de desarrollo.

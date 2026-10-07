# Conector Contasimple de solo lectura

Esta Edge Function es la única puerta de acceso permitida entre el ERP y
Contasimple.

- Lee `CONTASIMPLE_API_KEY` desde los secretos del proyecto Supabase.
- Nunca devuelve ni registra el valor de la clave.
- Exige una sesión válida del ERP.
- Limita el acceso a usuarios activos con rol `admin` o `encargado`.
- Rechaza cualquier acción que no esté incluida en la lista de lectura.
- La acción `test` comprueba únicamente que el secreto existe.
- Las consultas externas permanecen bloqueadas hasta confirmar la URL base y
  los endpoints oficiales de la API Rest de Contasimple.

La función debe desplegarse exclusivamente en el proyecto de desarrollo
`obigqojehfxxgfluygdg` durante esta fase.

## Verificación del 7 de octubre de 2026

- Función desplegada en `desarrollo-seguro` con el nombre
  `contasimple-readonly`.
- Secreto utilizado: `CONTASIMPLE_API_KEY`.
- Autenticación de Contasimple confirmada mediante
  `grant_type=authentication_key`.
- Prueba ejecutada desde una sesión administrativa del ERP.
- Resultado mostrado en el Centro IA360: `Conectado en modo solo lectura`.
- No se descargaron ni persistieron facturas durante esta prueba.

# Punto de restauración — Control de preparación del presupuesto v1

Fecha: 10/10/2026

## Cambio realizado

Se añadió al final de `Visita y presupuesto` un control de preparación que resume si el borrador puede pasar a valoración comercial.

Comprueba en tiempo real:

- que existan partidas incluidas;
- que todas estén identificadas en la biblioteca;
- que tengan cantidades;
- que tengan precios, incluidos los componentes de precio activos;
- que las mediciones vinculadas estén confirmadas;
- que las revisiones preventivas de alcance estén decididas;
- que no queden datos por confirmar con el cliente o durante el replanteo.

El resultado muestra `Listo para revisar` cuando todo está completo o el número de grupos pendientes cuando aún falta información.

## Seguridad funcional

- Es un control informativo dentro del borrador.
- No crea obras.
- No genera facturas ni presupuestos externos.
- No envía datos a ContaSimple.
- No se ha tocado producción.

## Verificación

- ESLint correcto.
- Compilación Vite local correcta.
- Probado con el lead exclusivo de desarrollo.
- Resultado de la prueba actual: 20 partidas incluidas, biblioteca completa, mediciones utilizadas confirmadas y cuatro grupos pendientes: cantidades, precios, una revisión de alcance y datos por confirmar.

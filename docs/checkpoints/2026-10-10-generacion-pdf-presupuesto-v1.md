# Punto de restauración — PDF de presupuesto v1

Fecha: 2026-10-10

## Alcance terminado

- La vista previa del presupuesto incluye dos acciones diferenciadas:
  - `PDF borrador`, disponible durante la preparación.
  - `PDF definitivo`, bloqueado hasta que el control de preparación esté completo.
- El borrador incorpora estado y marca diagonal `BORRADOR`.
- La generación se realiza en el navegador con los datos ya revisados del ERP; no envía el documento a ContaSimple ni a servicios externos.
- El nombre del archivo incluye cliente, estado de borrador y fecha.
- Los capítulos se mantienen unidos a su primera partida y las partidas no se cortan entre páginas.
- El pie informativo interno se conserva en pantalla, pero se omite al exportar para evitar una página final vacía.

## Validación realizada

- ESLint finalizado sin errores.
- Compilación Vite finalizada correctamente.
- Descarga real realizada desde el navegador local.
- PDF A4 de seis páginas renderizado e inspeccionado página a página.
- Verificados: cabecera y cliente, objeto breve, orden de capítulos, marca de borrador, desglose, totales, advertencia de revisión, condiciones y forma de pago 50/25/25.
- El botón definitivo permanece deshabilitado en el lead de prueba porque quedan cuatro grupos de revisión pendientes.

## Artefacto de prueba

`output/pdf/presupuesto-borrador-prueba.pdf`

## Seguridad del entorno

- Validación realizada exclusivamente contra Supabase de desarrollo `obigqojehfxxgfluygdg` mediante `/backend-dev`.
- Producción y ContaSimple no se han modificado.


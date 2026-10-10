# Punto de restauración: valoración comercial del presupuesto v1

Fecha: 2026-10-10

## Alcance

- Se añadió al presupuesto interno una valoración comercial editable.
- Permite definir:
  - porcentaje de gastos generales;
  - margen comercial sobre el coste de partidas más gastos generales;
  - porcentaje de IVA, con 21 % como valor inicial.
- El resumen muestra de forma separada:
  - coste de partidas;
  - gastos generales;
  - margen;
  - base imponible;
  - IVA;
  - total del presupuesto.
- Los porcentajes se guardan con el borrador del lead en `visitas_presupuesto.ajustes_comerciales`.

## Base de datos de desarrollo

- Proyecto: `obigqojehfxxgfluygdg` — NuevaERP desarrollo-seguro.
- Migración aplicada: `supabase/migrations/20261010150000_ajustes_comerciales_presupuesto.sql`.
- Resultado: `Success. No rows returned`.

## Verificación

- ESLint correcto.
- Compilación Vite local correcta.
- Prueba de cálculo:
  - coste de partidas: 100,00 €;
  - gastos generales: 10 % = 10,00 €;
  - margen sobre coste ampliado: 20 % = 22,00 €;
  - base imponible: 132,00 €;
  - IVA: 21 % = 27,72 €;
  - total: 159,72 €.
- Persistencia comprobada después de guardar y recargar.
- Al terminar se restauraron los valores del borrador de prueba a 0 % de gastos generales, 0 % de margen y 21 % de IVA.

## Seguridad

- No se modificó producción.
- No se creó ninguna obra.
- No se generó ni envió ningún presupuesto a ContaSimple.

## Próximo paso recomendado

Crear una vista previa imprimible del presupuesto y mantenerla bloqueada mientras el control previo tenga incidencias pendientes.


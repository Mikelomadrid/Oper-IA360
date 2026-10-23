# Fase 2 — Keyword research y arquitectura SEO

## Estado del documento

**Proyecto:** Portal local de Orcasitas  
**Ámbito inicial:** Poblado Dirigido de Orcasitas  
**Objetivo:** preparar la estructura SEO y el briefing de construcción del MVP para Lovable  
**Estado:** plantilla de trabajo; pendiente de incorporar los datos finales del keyword research

---

## 1. Objetivo de la fase

Convertir el concepto y el inventario inicial del MVP en una arquitectura SEO accionable. El resultado debe indicar:

- qué búsquedas se deben trabajar;
- qué intención tiene cada grupo de búsquedas;
- qué página responde a cada necesidad;
- qué páginas forman parte del MVP;
- qué contenidos quedan para fases posteriores;
- cómo se conectan las páginas entre sí;
- qué tipos de datos y componentes debe construir Lovable.

## 2. Contexto de investigación

- **Semilla principal:** Poblado Dirigido de Orcasitas.
- **Ubicación:** Madrid, España.
- **Idioma:** español.
- **Objetivo SEO:** portal local informativo, directorio y guía vecinal.
- **Dominio:** todavía no definido.
- **Público:** vecinos, familias, mayores, visitantes, usuarios de servicios y negocios locales.
- **Subzonas futuras:** Meseta de Orcasitas y Orca Sur.

## 3. Grupos de semillas

- Barrio y ubicación.
- Educación.
- Salud.
- Transporte.
- Parques y plazas.
- Deporte.
- Cultura y ocio.
- Mayores y servicios sociales.
- Asociaciones.
- Comercios y servicios profesionales.
- Historia y memoria.
- Actividades y actualidad.

## 4. Tabla principal de keywords

| Keyword | Cluster | Intención | Ubicación | Volumen | Dificultad | Página recomendada | Prioridad | Estado |
|---|---|---|---|---:|---:|---|---|---|
| Pendiente de investigación | | | | N/D | N/D | | | |

## 5. Clusters y páginas objetivo

### 5.1. Página principal del Poblado Dirigido

**URL provisional:** `/orcasitas/poblado-dirigido/`

Debe responder a búsquedas generales sobre el barrio, ubicación, servicios y recursos principales.

### 5.2. Educación

**URL provisional:** `/orcasitas/poblado-dirigido/educacion/`

Subpáginas o fichas potenciales:

- CEIP Puerto Rico.
- IES Pío Baroja.
- Escuela Infantil La Oliva.
- Colegio Santa María–Marianistas.
- CEPA Orcasitas.
- Escuela Municipal de Música Maestro Barbieri.

### 5.3. Salud

**URL provisional:** `/orcasitas/poblado-dirigido/salud/`

- Centro de Salud Orcasitas.
- Centro de Especialidades Periférico Orcasitas.
- Farmacias.
- Clínicas y profesionales.

### 5.4. Transporte

**URL provisional:** `/orcasitas/poblado-dirigido/transporte/`

- Línea 6.
- Línea 60.
- Líneas 78, 81, 116, 121 y 131.
- Cercanías Orcasitas.

### 5.5. Plazas, parques y zonas verdes

**URL provisional:** `/orcasitas/poblado-dirigido/parques-y-plazas/`

- Plaza de Oyarzun.
- Plaza de Elciego.
- Plaza de Zapola.
- Plaza de Ermua.
- Plaza del Puerto de Urquiola.
- Plaza de Munguía.
- Plaza del Puerto de Barazar.
- Plaza de Sestao.
- Plaza de Jaizquibel.

### 5.6. Deporte

**URL provisional:** `/orcasitas/poblado-dirigido/deporte/`

- Centro Deportivo Municipal Orcasitas.
- Pistas y espacios deportivos.
- Clubes y escuelas.

### 5.7. Asociaciones y comunidad

**URL provisional:** `/orcasitas/poblado-dirigido/asociaciones/`

- Asociación Vecinal Guetaria.
- Halcones de la Amistad.
- Clubes y entidades con actividad confirmada.

### 5.8. Comercios

**URL provisional:** `/orcasitas/poblado-dirigido/comercios/`

- Mercado Municipal de Orcasitas.
- Galería Comercial Deva.
- Galerías Comerciales Guetaria.
- Comercios por categoría.

## 6. Tipos de intención

- **Local:** usuario que busca un recurso en Orcasitas.
- **Navegacional:** usuario que busca una entidad concreta.
- **Informacional:** usuario que quiere conocer el barrio, su historia o sus servicios.
- **Actividad:** usuario que busca eventos, talleres o actividades.
- **Comercial local:** usuario que busca un negocio o profesional.
- **Transporte:** usuario que necesita una ruta, línea o conexión.

## 7. Reglas de agrupación

- No crear una página por cada variante de keyword.
- Agrupar términos que respondan a la misma necesidad.
- Crear fichas individuales cuando exista valor práctico, demanda o relevancia local.
- Separar el Poblado Dirigido de Orcasitas general.
- No crear páginas de categorías sin recursos suficientes.
- Mantener las páginas de actualidad fuera del directorio, pero conectadas mediante enlaces internos.

## 8. Arquitectura provisional

```text
/
├── orcasitas/
│   ├── poblado-dirigido/
│   │   ├── educacion/
│   │   ├── salud/
│   │   ├── transporte/
│   │   ├── parques-y-plazas/
│   │   ├── deporte/
│   │   ├── cultura/
│   │   ├── mayores-y-servicios-sociales/
│   │   ├── asociaciones/
│   │   ├── comercios/
│   │   └── historia/
│   ├── meseta-de-orcasitas/
│   └── orca-sur/
├── mapa/
├── directorio/
├── actualidad/
├── eventos/
└── participar/
```

## 9. Requisitos para Lovable

### Componentes del MVP

- Página de inicio.
- Página de subzona.
- Página de categoría.
- Ficha individual.
- Mapa.
- Buscador.
- Filtros.
- Formulario de correcciones.
- Sistema de fuentes y fecha de actualización.
- Diseño responsive.

### Modelo de datos mínimo

- Recurso.
- Categoría.
- Subcategoría.
- Subzona.
- Dirección.
- Coordenadas.
- Contacto.
- Horarios.
- Servicios.
- Accesibilidad.
- Fuente.
- Estado de verificación.
- Fecha de comprobación.

## 10. Próximos pasos

1. Incorporar los datos del keyword research.
2. Ordenar keywords por intención y prioridad.
3. Decidir qué URLs entran en el MVP.
4. Crear el mapa final de arquitectura.
5. Definir títulos, H1 y objetivos de cada página.
6. Preparar el enlazado interno.
7. Redactar el briefing maestro para Lovable.
8. Construir y cargar el primer prototipo.

## 11. Limitaciones

- Todavía no hay dominio propio.
- El keyword research debe confirmar volúmenes y dificultad.
- El inventario comercial necesita actualización.
- Los límites exactos del Poblado Dirigido deben afinarse cartográficamente.
- Los horarios y líneas de transporte necesitan revisión periódica.

## 12. Resultado del keyword research de DinoRANK

### Contexto

- **Herramienta principal:** DinoRANK, módulo Keyword Research.
- **Semillas procesadas:** 16.
- **Ubicación:** Madrid / Orcasitas.
- **Idioma:** español.
- **Dominio:** no disponible.
- **Objetivo:** SEO local e informacional para un portal de barrio.
- **Modo:** solo lectura.

### Métricas visibles

| Keyword | Volumen | CPC | Dificultad | Competencia | Tendencia visible | Página recomendada | Prioridad |
|---|---:|---:|---:|---|---|---|---|
| orcasitas | 40.500 | N/D | N/D | N/D | N/D | `/orcasitas/` | P1 |
| polideportivo municipal de orcasitas | 18.100 | N/D | N/D | N/D | N/D | `/orcasitas/deporte-y-parques/` | P1 |
| polideportivo orcasitas | 2.900 | 0,01 | 40 | Baja | 1.900–4.400 | `/orcasitas/deporte-y-parques/` | P1 |
| centro de salud orcasitas | 720 | 0 | 47 | Baja | 480–880 | `/orcasitas/servicios/salud/` | P1 |
| farmacias orcasitas | 390 | 0 | 34 | Baja | 260–390 | `/orcasitas/servicios/farmacias/` | P1 |
| mercado orcasitas | 140 | 0 | 33 | Baja | 90–170 | `/orcasitas/comercios/mercado/` | P2 |
| poblado dirigido de orcasitas | 110 | 0 | 25 | Baja | 90–140 | `/poblado-dirigido-de-orcasitas/` | P2 |
| cercanías orcasitas | 90 | 0 | 32 | Baja | 50–170 | `/orcasitas/transporte/` | P2 |
| colegios orcasitas | 70 | 0 | 32 | Baja | 30–110 | `/orcasitas/servicios/educacion/` | P2 |
| fiestas orcasitas | 30 | 0 | 27 | Baja | Pico visible de 260 en junio | `/orcasitas/fiestas/` | P3 |
| orcasitas servicios | N/D | N/D | N/D | N/D | N/D | `/orcasitas/servicios/` | P2 |
| transporte orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/transporte/` | P2 |
| autobuses orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/transporte/` | P2 |
| parques orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/deporte-y-parques/` | P3 |
| asociaciones orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/asociaciones-y-actividades/` | P3 |
| actividades orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/asociaciones-y-actividades/` | P3 |
| comercios orcasitas | N/D | N/D | N/D | N/D | N/D | `/orcasitas/comercios/` | P3 |
| historia de orcasitas | N/D | N/D | N/D | N/D | N/D | `/poblado-dirigido-de-orcasitas/historia/` | P3 |

### Oportunidades prioritarias

1. **Portal general:** `orcasitas` — 40.500 búsquedas visibles.
2. **Deporte:** `polideportivo municipal de orcasitas` — 18.100 y `polideportivo orcasitas` — 2.900.
3. **Salud:** `centro de salud orcasitas` — 720 y `farmacias orcasitas` — 390.
4. **Comercio:** `mercado orcasitas` — 140.
5. **Identidad del piloto:** `poblado dirigido de orcasitas` — 110.
6. **Transporte:** `cercanías orcasitas` — 90.
7. **Educación:** `colegios orcasitas` — 70.

### Clusters recomendados para el MVP

| Cluster | URL principal | Contenido |
|---|---|---|
| Portal general | `/orcasitas/` | Servicios, mapa, subzonas y acceso al directorio |
| Servicios | `/orcasitas/servicios/` | Salud, educación, farmacias y servicios públicos |
| Salud | `/orcasitas/servicios/salud/` | Centro de salud, especialidades y clínicas |
| Educación | `/orcasitas/servicios/educacion/` | Colegios, instituto, escuela infantil y música |
| Transporte | `/orcasitas/transporte/` | Autobuses, Cercanías, paradas y accesos |
| Deporte y parques | `/orcasitas/deporte-y-parques/` | Polideportivo, pistas, parques y actividades |
| Comercio | `/orcasitas/comercios/` | Mercado, galerías y negocios por categoría |
| Poblado Dirigido | `/poblado-dirigido-de-orcasitas/` | Identidad, historia y recursos propios |
| Asociaciones y actividades | `/orcasitas/asociaciones-y-actividades/` | Entidades, agenda y participación |
| Fiestas | `/orcasitas/fiestas/` | Calendario anual y contenidos estacionales |

### Separación territorial

- **Poblado Dirigido:** historia, identidad y recursos propios.
- **Orcasitas general:** servicios, transporte, colegios, salud y comercio.
- **Meseta:** centro cultural, actividades y equipamientos.
- **Orca Sur:** subsección territorial pendiente de validar con una investigación específica.

### Limitaciones

- Google Keyword Planner estaba abierto, pero el acceso quedó bloqueado por un bloqueador de anuncios.
- No se incorporan métricas de Google Ads.
- Las semillas sin métrica visible se conservan como `N/D`; no se han inventado valores.
- No se verificaron competidores SEO directos de forma fiable.

### Exportaciones de DinoRANK

Se descargaron CSV originales de las búsquedas en la carpeta de descargas del entorno de investigación. Los archivos principales son:

Se ha conservado una copia de trabajo dentro de `ESTUDIO-MVP-ORCASITAS/datos-dinorank/`, sin modificar los originales.

- `Poblado_Dirigido_de_Orcasitas.csv`
- `Orcasitas_servicios.csv`
- `colegios_Orcasitas.csv`
- `centro_de_salud_Orcasitas.csv`
- `transporte_Orcasitas.csv`
- `autobuses_Orcasitas.csv`
- `Cercanias_Orcasitas.csv`
- `parques_Orcasitas.csv`
- `polideportivo_Orcasitas.csv`
- `asociaciones_Orcasitas.csv`
- `actividades_Orcasitas.csv`
- `mercado_Orcasitas.csv`
- `comercios_Orcasitas.csv`
- `farmacias_Orcasitas.csv`
- `historia_de_Orcasitas.csv`
- `fiestas_Orcasitas.csv`

## 13. Validación en Google Keyword Planner

### Configuración de la consulta

- **Segmentación:** España.
- **Idioma:** español.
- **Red:** Google.
- **Periodo:** últimos 12 meses, octubre de 2025 a septiembre de 2026.
- **Fecha de consulta:** 24 de octubre de 2026.
- **Nota geográfica:** la interfaz mostró España/Español, pero no dejó visible un desglose separado de Madrid.

### Datos visibles

| Keyword | Búsquedas/mes | Competencia | Puja baja–alta | Tendencia 3 meses | Tendencia interanual |
|---|---:|---|---|---:|---:|
| orcasitas | 49.500 | Baja | N/D | 0% | 0% |
| polideportivo municipal de orcasitas | 9.900 | Baja | 0,17–1,95 € | 0% | -84% |
| polideportivo orcasitas | 5.400 | Baja | 0,57–1,23 € | +22% | +83% |
| centro de salud orcasitas | 720 | Baja | 0,34–2,09 € | +49% | +49% |
| farmacias orcasitas | 390 | Baja | N/D | 0% | +22% |
| mercado orcasitas | 170 | Baja | 0,05–0,09 € | +24% | +50% |
| poblado dirigido de orcasitas | 110 | Baja | N/D | +80% | 0% |
| colegios orcasitas | 50 | Baja | N/D | +75% | -22% |
| fiestas orcasitas | 40 | Baja | N/D | 0% | 0% |
| cercanías orcasitas | N/D | N/D | N/D | N/D | N/D |
| orcasitas servicios | N/D | N/D | N/D | N/D | N/D |
| transporte orcasitas | N/D | N/D | N/D | N/D | N/D |
| autobuses orcasitas | N/D | N/D | N/D | N/D | N/D |
| parques orcasitas | N/D | N/D | N/D | N/D | N/D |
| asociaciones orcasitas | N/D | N/D | N/D | N/D | N/D |
| actividades orcasitas | N/D | N/D | N/D | N/D | N/D |
| comercios orcasitas | N/D | N/D | N/D | N/D | N/D |
| historia de orcasitas | N/D | N/D | N/D | N/D | N/D |

### Comparación de fuentes

Las cifras no deben mezclarse como si fueran idénticas: DinoRANK y Google Keyword Planner pueden usar bases, ventanas temporales y redondeos diferentes. Se utilizarán así:

- **Google Keyword Planner:** referencia principal para demanda publicitaria y promedio de búsquedas en España.
- **DinoRANK:** referencia complementaria para dificultad, competencia SEO, CPC visible y tendencias de su propia base.
- **Decisión SEO:** priorizar términos que tengan demanda en al menos una fuente y encajen con una necesidad real del portal.

Ejemplos de diferencias observadas:

| Keyword | DinoRANK | Google Keyword Planner | Lectura |
|---|---:|---:|---|
| orcasitas | 40.500 | 49.500 | Demanda muy alta; página paraguas prioritaria |
| polideportivo municipal de orcasitas | 18.100 | 9.900 | Gran oportunidad temática; requiere página específica |
| polideportivo orcasitas | 2.900 | 5.400 | Demanda fuerte y tendencia positiva en Google |
| centro de salud orcasitas | 720 | 720 | Coincidencia; prioridad alta |
| farmacias orcasitas | 390 | 390 | Coincidencia; prioridad alta |
| mercado orcasitas | 140 | 170 | Demanda local confirmada |
| colegios orcasitas | 70 | 50 | Demanda menor pero relevante para familias |

### Limitaciones de Google Keyword Planner

- No se obtuvo desglose exclusivo para Madrid.
- Ocho keywords aparecieron con guiones, no con cero; se conservan como `N/D`.
- No se ejecutaron nuevas consultas sobre la búsqueda existente de autobuses para no consumir análisis ni modificar datos.
- La consulta de `autobuses orcasitas` visible en DinoRANK mostró volumen 0, tendencia “No hay”, CPC “No calculada” y competencia baja.

### Exportación conservada

La exportación original se ha copiado sin modificar a:

`ESTUDIO-MVP-ORCASITAS/datos-google-keyword-planner/google-keyword-planner-orcasitas-2026-10-24.csv`

## 14. Prioridad SEO actualizada

### P1 — Lanzamiento

- `/orcasitas/` — portal general.
- `/orcasitas/deporte-y-parques/` — polideportivo y parques.
- `/orcasitas/servicios/salud/` — centro de salud y especialidades.
- `/orcasitas/servicios/farmacias/` — farmacias.

### P2 — Segundo bloque del MVP

- `/orcasitas/comercios/mercado/` — mercado municipal.
- `/poblado-dirigido-de-orcasitas/` — identidad e información del piloto.
- `/orcasitas/transporte/` — Cercanías, autobuses y accesos.
- `/orcasitas/servicios/educacion/` — colegios y centros educativos.

### P3 — Contenido de apoyo y crecimiento

- `/orcasitas/comercios/`.
- `/orcasitas/asociaciones-y-actividades/`.
- `/orcasitas/fiestas/`.
- `/poblado-dirigido-de-orcasitas/historia/`.
- Páginas específicas para Meseta y Orca Sur.

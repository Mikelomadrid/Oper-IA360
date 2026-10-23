# Informe de arquitectura SEO y briefing para Lovable

## Portal local de Orcasitas — MVP del Poblado Dirigido

**Proyecto:** portal informativo, directorio y guía vecinal de Orcasitas  
**MVP inicial:** Poblado Dirigido de Orcasitas  
**Idioma:** español  
**Ubicación:** Madrid, España  
**Estado:** documento maestro para diseño y construcción del MVP  
**Fecha:** 24 de octubre de 2026

---

## 1. Resumen del proyecto

Crear un portal local de referencia para Orcasitas que reúna en un único sitio:

- servicios públicos;
- centros educativos y sanitarios;
- transporte;
- plazas, parques y zonas deportivas;
- asociaciones y actividades;
- comercios y profesionales;
- historia, actualidad y memoria del barrio.

El primer lanzamiento se limitará al **Poblado Dirigido de Orcasitas**. La arquitectura debe permitir ampliar posteriormente el portal a la Meseta de Orcasitas, Orca Sur y el conjunto de Orcasitas sin rehacer la base técnica.

## 2. Objetivos del MVP

### Objetivo principal

Crear una primera versión útil, navegable y posicionable que permita a los usuarios localizar recursos del barrio y validar qué contenidos tienen más demanda.

### Objetivos secundarios

- Validar la estructura del directorio.
- Probar un mapa local de recursos.
- Crear fichas homogéneas y actualizables.
- Generar tráfico SEO local.
- Facilitar correcciones y recomendaciones vecinales.
- Preparar una futura relación comercial con negocios.

### Fuera del alcance inicial

- Valoraciones públicas.
- Red social vecinal completa.
- Reservas o pagos.
- Perfiles avanzados de negocios.
- Monetización automatizada.
- Cobertura exhaustiva de todo Orcasitas.
- Aplicación móvil nativa.

---

## 3. Público objetivo

### Usuarios principales

- Vecinos del Poblado Dirigido.
- Familias que buscan colegios y servicios.
- Personas mayores.
- Usuarios que necesitan transporte o atención sanitaria.
- Personas que buscan comercios y profesionales próximos.
- Nuevos residentes.

### Usuarios secundarios

- Visitantes.
- Asociaciones y entidades locales.
- Comerciantes.
- Periodistas y estudiantes interesados en la historia del barrio.
- Administraciones y proyectos comunitarios.

---

## 4. Investigación SEO utilizada

### Fuentes de datos

- DinoRANK Keyword Research.
- Google Keyword Planner.
- Fuentes oficiales del Ayuntamiento de Madrid.
- Comunidad de Madrid.
- CRTM y EMT.
- Asociación Vecinal Guetaria.

### Métricas principales observadas

| Keyword | Google Keyword Planner | DinoRANK | Decisión |
|---|---:|---:|---|
| orcasitas | 49.500 | 40.500 | Crear página paraguas prioritaria |
| polideportivo municipal de orcasitas | 9.900 | 18.100 | Crear contenido deportivo prioritario |
| polideportivo orcasitas | 5.400 | 2.900 | Integrar en la misma página deportiva |
| centro de salud orcasitas | 720 | 720 | Crear página de salud y ficha |
| farmacias orcasitas | 390 | 390 | Crear categoría y fichas |
| mercado orcasitas | 170 | 140 | Crear página del mercado |
| poblado dirigido de orcasitas | 110 | 110 | Crear página de identidad |
| colegios orcasitas | 50 | 70 | Crear página educativa |
| fiestas orcasitas | 40 | 30 | Crear página estacional |

Google Keyword Planner se consultó con segmentación España, español, red Google y periodo octubre de 2025 a septiembre de 2026. No se obtuvo desglose exclusivo para Madrid. DinoRANK se utilizará como referencia complementaria de dificultad, CPC y tendencias SEO.

---

## 5. Arquitectura SEO definitiva del MVP

```text
/
├── orcasitas/
│   ├── servicios/
│   │   ├── salud/
│   │   ├── educacion/
│   │   └── farmacias/
│   ├── transporte/
│   ├── deporte-y-parques/
│   ├── comercios/
│   │   └── mercado/
│   ├── asociaciones-y-actividades/
│   └── fiestas/
├── poblado-dirigido-de-orcasitas/
│   └── historia/
├── mapa/
├── directorio/
├── actualidad/
└── participar/
```

### Regla territorial

- `/orcasitas/` será la página paraguas de la zona general.
- `/poblado-dirigido-de-orcasitas/` será la página específica del piloto.
- Las páginas de servicios generales pueden pertenecer a Orcasitas, aunque incluyan recursos cercanos al Poblado.
- Cada ficha tendrá un campo de clasificación geográfica: dentro, límite, cercano o distrito.

---

## 6. Mapa de páginas

### 6.1. Página principal `/`

**Objetivo:** presentar el portal y dirigir al usuario hacia la zona o necesidad que busca.

**Elementos:**

- buscador principal;
- selector de zona;
- categorías destacadas;
- mapa resumido;
- recursos populares;
- actualidad;
- llamada a participar.

### 6.2. Página paraguas `/orcasitas/`

**Keyword principal:** `orcasitas`.

**Contenido:**

- descripción de Orcasitas;
- acceso al Poblado Dirigido, Meseta y Orca Sur;
- servicios principales;
- mapa general;
- transporte;
- educación y salud;
- comercio;
- actualidad;
- enlaces a categorías.

### 6.3. Página del piloto `/poblado-dirigido-de-orcasitas/`

**Keyword principal:** `poblado dirigido de orcasitas`.

**Contenido:**

- presentación del barrio;
- límites y mapa;
- historia resumida;
- recursos destacados;
- plazas y espacios;
- asociaciones;
- colegios y servicios;
- comercios;
- enlaces a fichas y categorías.

### 6.4. Servicios `/orcasitas/servicios/`

**Keyword objetivo:** `orcasitas servicios`.

**Subcategorías:**

- salud;
- educación;
- farmacias;
- mayores y servicios sociales;
- oficinas y servicios públicos.

### 6.5. Salud `/orcasitas/servicios/salud/`

**Keywords:** `centro de salud orcasitas`, `centro de especialidades orcasitas`.

**Recursos iniciales:**

- Centro de Salud Orcasitas;
- Centro de Especialidades Periférico Orcasitas;
- clínicas y profesionales cuando estén verificados.

### 6.6. Educación `/orcasitas/servicios/educacion/`

**Keyword:** `colegios orcasitas`.

**Recursos iniciales:**

- CEIP Puerto Rico;
- IES Pío Baroja;
- Escuela Infantil Municipal La Oliva;
- Colegio Santa María–Marianistas;
- CEPA Orcasitas;
- Escuela Municipal de Música Maestro Barbieri.

### 6.7. Farmacias `/orcasitas/servicios/farmacias/`

**Keyword:** `farmacias orcasitas`.

Debe mostrar listado, mapa, dirección, teléfono, horario y ficha de cada farmacia verificada.

### 6.8. Transporte `/orcasitas/transporte/`

**Keywords:** `transporte orcasitas`, `autobuses orcasitas`, `cercanías orcasitas`.

**Contenido:**

- línea 6;
- línea 60;
- líneas 78, 81, 116, 121 y 131 del entorno;
- Cercanías Orcasitas;
- paradas;
- conexiones;
- mapa;
- enlaces oficiales de horarios.

### 6.9. Deporte y parques `/orcasitas/deporte-y-parques/`

**Keywords:** `polideportivo orcasitas`, `polideportivo municipal de orcasitas`, `parques orcasitas`.

**Contenido:**

- Centro Deportivo Municipal Orcasitas;
- pistas deportivas;
- parques;
- zonas infantiles;
- zonas caninas;
- plazas;
- estado de obras;
- actividades deportivas.

### 6.10. Comercio `/orcasitas/comercios/`

**Keyword:** `comercios orcasitas`.

**Subcategorías:**

- alimentación;
- restauración;
- salud y farmacias;
- belleza;
- servicios profesionales;
- hogar y reparaciones;
- educación y formación.

### 6.11. Mercado `/orcasitas/comercios/mercado/`

**Keyword:** `mercado orcasitas`.

**Contenido:**

- ubicación;
- horarios;
- puestos;
- comercios interiores;
- locales exteriores;
- mapa;
- cómo llegar;
- ficha de actualización.

### 6.12. Asociaciones `/orcasitas/asociaciones-y-actividades/`

**Keywords:** `asociaciones orcasitas`, `actividades orcasitas`.

**Contenido:**

- Asociación Vecinal Guetaria;
- Halcones de la Amistad;
- entidades deportivas;
- asociaciones juveniles;
- agenda;
- proyectos comunitarios;
- formulario para añadir o corregir una entidad.

### 6.13. Fiestas `/orcasitas/fiestas/`

**Keyword:** `fiestas orcasitas`.

Página estacional con calendario anual, programa, ubicación, organizadores y archivo de ediciones anteriores.

### 6.14. Historia `/poblado-dirigido-de-orcasitas/historia/`

**Keyword:** `historia de orcasitas`.

Contenido sobre origen, remodelación, movimiento vecinal, arquitectura, rehabilitación y memoria fotográfica.

---

## 7. Tipos de página y plantillas

### 7.1. Plantilla de categoría

- Breadcrumbs.
- H1 descriptivo.
- Introducción de 100–250 palabras.
- Mapa de recursos.
- Filtros.
- Listado de fichas.
- Preguntas frecuentes.
- Enlaces a categorías relacionadas.
- Fecha de actualización.

### 7.2. Plantilla de recurso

- Nombre.
- Categoría.
- Descripción.
- Dirección.
- Mapa.
- Coordenadas.
- Teléfono.
- Correo.
- Web.
- Horario.
- Servicios.
- Accesibilidad.
- Transporte cercano.
- Fotografías.
- Fuente.
- Fecha de comprobación.
- Botón “informar de un cambio”.

### 7.3. Plantilla de negocio

- Nombre comercial.
- Categoría.
- Descripción.
- Dirección.
- Horario.
- Teléfono y contacto.
- Web y redes.
- Servicios.
- Mapa.
- Fotografías.
- Estado abierto/cerrado/pendiente.
- Fecha de actualización.
- Opción futura de reclamar ficha.

### 7.4. Plantilla de actualidad

- Título.
- Fecha.
- Categoría.
- Imagen.
- Resumen.
- Texto.
- Fuente.
- Recursos relacionados.
- Estado de la noticia o actuación.

---

## 8. Modelo de datos

### Entidad `recurso`

```text
id
nombre
tipo
categoria
subcategoria
subzona
clasificacion_geografica
descripcion
direccion
codigo_postal
latitud
longitud
telefono
email
web
redes_sociales
horario
servicios
accesibilidad
transporte_cercano
imagenes
fuente_principal
fuentes_secundarias
estado_verificacion
fecha_comprobacion
fecha_proxima_revision
observaciones
```

### Entidad `categoria`

```text
id
nombre
slug
descripcion
icono
orden
activa
```

### Entidad `actualidad`

```text
id
titulo
slug
tipo
fecha_publicacion
fecha_actualizacion
resumen
contenido
imagen
fuente
recursos_relacionados
estado
```

### Entidad `sugerencia`

```text
id
tipo_solicitud
nombre_recurso
mensaje
email_opcional
fecha
estado_revision
```

---

## 9. Funcionalidades del MVP

### Imprescindibles

- Buscador por nombre, categoría y dirección.
- Mapa de recursos.
- Filtros por categoría y subzona.
- Fichas individuales.
- Enlaces para llamar y llegar.
- Diseño responsive.
- Formulario de correcciones.
- Fecha de última actualización.
- Sistema de fuentes.
- URLs limpias y editables.

### Recomendadas

- Selector “dentro del Poblado / cerca / distrito”.
- Recursos destacados.
- Listado de recientemente actualizados.
- Compartir ficha.
- Filtros de accesibilidad.
- Bloques de recursos relacionados.

### Futuras

- Perfiles reclamables por negocios.
- Valoraciones moderadas.
- Agenda con inscripciones.
- Newsletter.
- Patrocinios.
- Panel de estadísticas.
- Alertas de cambios.

---

## 10. Enlazado interno

### Desde la página general

- Enlazar a cada subzona.
- Enlazar a servicios prioritarios.
- Enlazar al mapa.
- Enlazar a actualidad.

### Desde cada categoría

- Enlazar a las fichas individuales.
- Enlazar a categorías relacionadas.
- Enlazar a la subzona correspondiente.
- Enlazar a guías y artículos útiles.

### Desde cada ficha

- Recursos cercanos.
- Misma categoría.
- Transporte próximo.
- Parques o servicios relacionados.
- Página de la subzona.

### Ejemplo

```text
Orcasitas
└── Poblado Dirigido
    ├── Educación
    │   ├── IES Pío Baroja
    │   └── Escuela Infantil La Oliva
    ├── Salud
    │   └── Centro de Salud Orcasitas
    ├── Transporte
    │   └── Línea 60
    └── Comercios
        └── Mercado Municipal
```

---

## 11. SEO técnico

Lovable debe implementar:

- URLs permanentes y legibles.
- Etiqueta `title` editable.
- Meta description editable.
- Un único H1 por página.
- Jerarquía correcta de H2 y H3.
- Canonical.
- Sitemap XML.
- Robots.txt.
- Open Graph.
- Datos estructurados cuando proceda.
- Breadcrumbs.
- Imágenes comprimidas y con texto alternativo.
- Diseño mobile-first.
- Buen rendimiento.
- Páginas 404 y redirecciones.
- No indexar filtros o combinaciones duplicadas.

### Datos estructurados recomendados

- `LocalBusiness` para negocios.
- `EducationalOrganization` para centros educativos.
- `MedicalOrganization` para centros sanitarios.
- `SportsActivityLocation` para instalaciones deportivas.
- `CivicStructure` o `Place` para plazas y espacios.
- `Article` para actualidad.
- `BreadcrumbList` para la navegación.

---

## 12. Requisitos de diseño

### Principios

- Claridad antes que decoración.
- Lectura rápida en móvil.
- Acceso visible al mapa.
- Categorías reconocibles.
- Información de contacto destacada.
- Confianza mediante fuentes y fechas.
- Identidad local sin saturar la interfaz.

### Componentes visuales

- Cabecera con buscador.
- Tarjetas de recursos.
- Filtros.
- Mapa.
- Chips de categoría.
- Etiquetas de estado.
- Bloque de contacto.
- Bloque de fuente y actualización.
- CTA “sugerir corrección”.

### Estados que debe mostrar la interfaz

- Verificado.
- Pendiente de actualización.
- En obras.
- Cerrado.
- Servicio cercano.
- Recurso del Poblado Dirigido.

---

## 13. Contenidos iniciales de lanzamiento

### Páginas prioritarias

1. Inicio.
2. `/orcasitas/`.
3. `/poblado-dirigido-de-orcasitas/`.
4. `/orcasitas/deporte-y-parques/`.
5. `/orcasitas/servicios/salud/`.
6. `/orcasitas/servicios/educacion/`.
7. `/orcasitas/servicios/farmacias/`.
8. `/orcasitas/transporte/`.
9. `/orcasitas/comercios/mercado/`.
10. `/orcasitas/asociaciones-y-actividades/`.
11. `/poblado-dirigido-de-orcasitas/historia/`.
12. `/orcasitas/fiestas/`.

### Fichas iniciales

- Centro de Salud Orcasitas.
- Centro de Especialidades Periférico Orcasitas.
- IES Pío Baroja.
- Escuela Infantil Municipal La Oliva.
- Escuela Municipal de Música Maestro Barbieri.
- Centro Municipal de Mayores Arturo Pajuelo.
- Centro Deportivo Municipal Orcasitas.
- Parque Mujeres de Orcasitas.
- Mercado Municipal de Orcasitas.
- Asociación Vecinal Guetaria.
- Línea 6.
- Línea 60.
- Cercanías Orcasitas.

---

## 14. Roadmap de desarrollo

### Sprint 1 — Base del producto

- Configurar estructura del proyecto.
- Crear navegación.
- Crear categorías.
- Crear modelo de datos.
- Crear componentes visuales.

### Sprint 2 — Directorio y fichas

- Crear listado.
- Crear filtros.
- Crear ficha de recurso.
- Crear ficha de negocio.
- Cargar recursos iniciales.

### Sprint 3 — Mapa y buscador

- Integrar mapa.
- Añadir coordenadas.
- Implementar búsquedas.
- Implementar filtros geográficos.

### Sprint 4 — SEO y contenidos

- Cargar textos.
- Configurar metadatos.
- Crear breadcrumbs.
- Configurar sitemap y robots.
- Añadir datos estructurados.

### Sprint 5 — Participación y revisión

- Formulario de correcciones.
- Revisión móvil.
- Pruebas de navegación.
- Comprobación de contenidos.
- Corrección de errores.

---

## 15. Instrucción resumida para Lovable

> Construye un portal local responsive para Orcasitas, Madrid, empezando por el Poblado Dirigido de Orcasitas. El producto debe combinar guía de servicios, directorio local, mapa, fichas individuales y actualidad vecinal. La arquitectura debe soportar subzonas futuras como Meseta de Orcasitas y Orca Sur.
>
> Prioriza las páginas de Orcasitas general, Poblado Dirigido, deporte y parques, salud, educación, farmacias, transporte, mercado, asociaciones y actividades, fiestas e historia. Implementa buscador, filtros, mapa, fichas con contacto y fuentes, fecha de actualización y formulario para informar de cambios.
>
> Usa una arquitectura SEO con URLs limpias, títulos y metadescripciones editables, H1 único, breadcrumbs, sitemap, robots, canonical, Open Graph, datos estructurados y diseño mobile-first. No generes páginas vacías ni dupliques contenido entre Orcasitas general y Poblado Dirigido.
>
> El sistema de datos debe permitir recursos, categorías, subzonas, negocios, asociaciones, eventos y noticias. Cada recurso debe almacenar fuente, fecha de comprobación, estado de verificación, dirección, coordenadas, contacto, horarios, servicios y accesibilidad.

---

## 16. Criterios de aceptación del MVP

El MVP se considerará listo cuando:

- el usuario pueda encontrar un recurso desde el buscador;
- el usuario pueda explorar el mapa;
- cada categoría tenga contenido real;
- las fichas incluyan contacto y ubicación;
- se distinga el Poblado Dirigido de Orcasitas general;
- las páginas principales tengan metadatos;
- el sitio funcione correctamente en móvil;
- exista un sistema para informar de datos incorrectos;
- las fuentes y fechas sean visibles;
- no haya páginas prioritarias vacías;
- el contenido inicial esté revisado.

---

## 17. Próximo paso recomendado

El siguiente paso es convertir este documento en un prototipo funcional de baja fidelidad y después trasladarlo a Lovable para construir el primer MVP.

Antes de publicar, debe hacerse una revisión final de:

- fichas comerciales;
- horarios;
- transporte;
- límites geográficos;
- imágenes;
- textos SEO;
- enlaces y mapas.

---

## Documentos relacionados

- [Estudio general del MVP](ESTUDIO-MVP-ORCASITAS.md)
- [Keyword research y arquitectura SEO de trabajo](FASE-2-KEYWORD-RESEARCH-ARQUITECTURA-SEO.md)
- [Exportaciones DinoRANK](datos-dinorank/)
- [Exportación Google Keyword Planner](datos-google-keyword-planner/google-keyword-planner-orcasitas-2026-10-24.csv)

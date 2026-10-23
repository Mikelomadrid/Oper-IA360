# Prompt maestro inicial para Lovable

## Cómo utilizarlo

Pega el bloque completo de instrucciones en Lovable y adjunta los archivos indicados al final del documento.

---

## PROMPT PARA LOVABLE

Quiero construir un MVP de un portal local informativo y de servicios para Orcasitas, Madrid. El primer lanzamiento debe centrarse exclusivamente en el **Poblado Dirigido de Orcasitas**, pero la arquitectura técnica debe permitir ampliar posteriormente el proyecto a la Meseta de Orcasitas, Orca Sur y el conjunto de Orcasitas.

No quiero una web corporativa genérica ni una landing page simple. Quiero construir la primera versión de un portal de barrio que combine:

- guía práctica;
- directorio de recursos;
- mapa local;
- fichas individuales;
- actualidad vecinal;
- historia y memoria del barrio;
- participación ciudadana;
- comercios y servicios locales.

La prioridad del MVP es la utilidad, la claridad, la confianza y la posibilidad de ampliar el sistema. No hay que intentar construir todas las funcionalidades futuras desde el primer día.

### 1. Contexto del proyecto

El proyecto nace como una iniciativa personal para crear un portal de referencia de Orcasitas. El barrio se entiende como un ámbito general dividido en tres subzonas principales:

1. Poblado Dirigido de Orcasitas.
2. Meseta de Orcasitas.
3. Orca Sur.

El MVP se centrará en el Poblado Dirigido de Orcasitas.

La delimitación geográfica utilizada de forma provisional para el MVP se sitúa entre:

- avenida de los Poblados;
- avenida de Rafaela Ybarra;
- A-42;
- M-40.

Esta delimitación es operativa y deberá poder modificarse en el futuro con cartografía municipal.

Cada recurso debe poder clasificarse como:

- dentro del Poblado Dirigido;
- en el límite o zona de transición;
- servicio cercano de Orcasitas;
- servicio del distrito de Usera.

No mezcles automáticamente Orcasitas general con el Poblado Dirigido. La separación territorial es importante para la navegación, el SEO y la confianza del usuario.

### 2. Objetivos del MVP

El MVP debe permitir que una persona pueda:

- encontrar un colegio, centro de salud, farmacia o servicio;
- consultar cómo llegar a un recurso;
- localizar parques, plazas y zonas deportivas;
- descubrir comercios del barrio;
- encontrar asociaciones y actividades;
- consultar historia y actualidad del Poblado;
- proponer un recurso nuevo o corregir un dato;
- explorar el barrio mediante mapa, categorías y buscador.

### 3. Público objetivo

El público principal está formado por:

- vecinos del Poblado Dirigido;
- familias;
- personas mayores;
- usuarios que necesitan servicios públicos;
- nuevos residentes;
- visitantes;
- comerciantes y asociaciones locales.

### 4. Arquitectura principal

Utiliza esta arquitectura como base:

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

La página `/orcasitas/` será la página paraguas de la zona general. La página `/poblado-dirigido-de-orcasitas/` será la página de identidad y entrada al MVP.

### 5. Páginas que debe construir el MVP

Prioridad P1:

- `/`
- `/orcasitas/`
- `/poblado-dirigido-de-orcasitas/`
- `/orcasitas/servicios/salud/`
- `/orcasitas/servicios/educacion/`
- `/orcasitas/servicios/farmacias/`
- `/orcasitas/transporte/`
- `/orcasitas/deporte-y-parques/`
- `/orcasitas/comercios/`
- `/orcasitas/comercios/mercado/`
- `/mapa/`
- `/participar/`

Prioridad P2:

- `/orcasitas/asociaciones-y-actividades/`
- `/poblado-dirigido-de-orcasitas/historia/`
- `/actualidad/`

Prioridad P3:

- `/orcasitas/fiestas/`
- Meseta de Orcasitas.
- Orca Sur.
- perfiles avanzados de negocios.

### 6. Página de inicio

La home debe contener:

- nombre y propuesta de valor del portal;
- buscador principal;
- acceso visual a las categorías;
- selector de zona;
- acceso al mapa;
- recursos destacados;
- bloque de actualidad;
- llamada a participar;
- explicación breve de que los datos tienen fuente y fecha de actualización.

El buscador debe ser uno de los elementos más visibles de la página.

### 7. Página del Poblado Dirigido

Debe incluir:

- H1 “Poblado Dirigido de Orcasitas”;
- descripción breve y contextual;
- mapa de la zona;
- categorías principales;
- recursos destacados;
- plazas y espacios del barrio;
- asociaciones;
- historia;
- actualidad;
- botón para proponer o corregir información.

### 8. Categorías del portal

Implementa estas categorías:

- Salud.
- Educación.
- Transporte.
- Deporte y parques.
- Farmacias.
- Comercios.
- Asociaciones y actividades.
- Cultura.
- Mayores y servicios sociales.
- Historia.
- Fiestas.

Las categorías deben poder ampliarse sin modificar la estructura principal de la aplicación.

### 9. Fichas de recursos

Cada ficha debe tener estos campos:

- nombre;
- categoría;
- subcategoría;
- subzona;
- clasificación geográfica;
- descripción;
- dirección;
- código postal;
- coordenadas;
- teléfono;
- correo electrónico;
- web;
- redes sociales;
- horario;
- servicios;
- accesibilidad;
- transporte cercano;
- fotografías;
- fuente principal;
- fecha de comprobación;
- fecha de próxima revisión;
- estado de verificación;
- observaciones.

La ficha debe mostrar claramente:

- si el recurso está verificado;
- si está pendiente de actualización;
- si está en obras;
- si es un servicio cercano y no estrictamente interno del Poblado.

### 10. Fichas de comercios

Las fichas comerciales deben permitir:

- nombre comercial;
- categoría;
- descripción;
- servicios;
- dirección;
- horario;
- teléfono;
- web y redes;
- mapa;
- fotografías;
- estado de actividad;
- fecha de actualización;
- futura opción de reclamar o actualizar la ficha.

No presentes como definitivos los negocios que no hayan sido comprobados recientemente.

### 11. Recursos iniciales

Carga inicialmente los recursos del archivo `DATOS-MVP-LOVABLE.json`.

Entre los recursos iniciales se encuentran:

- Centro de Salud Orcasitas.
- Centro de Especialidades Periférico Orcasitas.
- IES Pío Baroja.
- Escuela Infantil Municipal La Oliva.
- Escuela Municipal de Música Maestro Barbieri.
- Centro Municipal de Mayores Arturo Pajuelo.
- Centro Deportivo Municipal Orcasitas.
- Línea 60.
- Cercanías Orcasitas.
- Mercado Municipal de Orcasitas.
- Asociación Vecinal Guetaria.

Respeta los estados de verificación incluidos en el JSON. No conviertas datos pendientes en datos verificados.

### 12. Buscador y filtros

El buscador debe permitir buscar por:

- nombre;
- categoría;
- subcategoría;
- calle;
- zona;
- servicio.

Los filtros mínimos son:

- categoría;
- subzona;
- dentro/límite/cercano;
- verificado/pendiente;
- accesibilidad;
- abierto o con horario disponible.

Los resultados deben poder mostrarse como:

- listado;
- tarjetas;
- mapa.

### 13. Mapa

El mapa debe:

- mostrar recursos por categorías;
- usar iconos o colores diferentes;
- abrir una tarjeta resumida al pulsar un marcador;
- enlazar a la ficha completa;
- permitir filtrar por categoría y zona;
- mostrar recursos cercanos;
- diferenciar recursos dentro del Poblado de recursos cercanos.

No inventes coordenadas. Si una coordenada no está disponible, deja el recurso pendiente de geolocalización.

### 14. Participación

La página `/participar/` debe incluir un formulario con estas opciones:

- proponer un recurso;
- corregir datos;
- comunicar un cierre;
- enviar una actividad;
- enviar una fotografía histórica;
- proponer un artículo.

Campos:

- tipo de solicitud;
- nombre del recurso;
- mensaje;
- fuente o enlace;
- correo opcional;
- archivo adjunto opcional.

El formulario debe guardar la solicitud con estado pendiente de revisión. No debe publicar automáticamente contenidos enviados por usuarios.

### 15. Diseño visual

El diseño debe ser:

- claro;
- cercano;
- accesible;
- mobile-first;
- fácil de leer para personas mayores;
- orientado a encontrar información rápidamente.

Prioriza:

1. buscador;
2. mapa;
3. categorías;
4. teléfono y cómo llegar;
5. fuente y fecha de actualización.

Usa tarjetas limpias, botones claros, buen contraste, tipografía legible y una navegación sencilla. La identidad visual debe transmitir barrio, comunidad y confianza sin convertir la interfaz en una web recargada.

### 16. SEO técnico

Implementa:

- URLs limpias;
- títulos editables;
- metadescripciones editables;
- un único H1 por página;
- H2 y H3 ordenados;
- breadcrumbs;
- canonical;
- sitemap XML;
- robots.txt;
- Open Graph;
- texto alternativo de imágenes;
- diseño responsive;
- páginas 404;
- redirecciones básicas;
- noindex para filtros duplicados.

Datos estructurados recomendados:

- `LocalBusiness`;
- `EducationalOrganization`;
- `MedicalOrganization`;
- `SportsActivityLocation`;
- `Place`;
- `Article`;
- `BreadcrumbList`.

### 17. Enlazado interno

Implementa estos enlaces:

- Orcasitas → subzonas.
- Subzona → categorías.
- Categoría → fichas.
- Ficha → recursos relacionados.
- Ficha → mapa y transporte cercano.
- Actualidad → recursos relacionados.
- Historia → página del Poblado Dirigido.

No generes páginas aisladas.

### 18. Imágenes

Utiliza únicamente imágenes:

- propias;
- cedidas con autorización;
- con licencia compatible;
- de dominio público correctamente comprobado.

No uses automáticamente imágenes encontradas en Google, Facebook o páginas públicas. Cada imagen debe poder asociarse a una fuente, autor, licencia o autorización. El registro está en `RECURSOS-VISUALES/REGISTRO-DERECHOS-IMAGENES.md`.

Si no hay una imagen autorizada, utiliza un bloque visual neutro o un marcador pendiente. No descargues ni publiques imágenes dudosas.

### 19. Fuera de alcance inicial

No implementes todavía:

- valoraciones públicas;
- comentarios abiertos;
- pagos;
- reservas;
- perfiles comerciales avanzados;
- publicidad automática;
- aplicación móvil nativa;
- red social vecinal completa.

Deja la estructura preparada para futuras ampliaciones, pero prioriza que el MVP sea estable y fácil de revisar.

### 20. Datos y fuentes

Los contenidos proceden de fuentes oficiales, fuentes vecinales y documentación del proyecto. Cada recurso debe conservar su fuente y fecha de comprobación.

No conviertas el portal en una copia automática de otras webs. Utiliza las fuentes para verificar datos y crea descripciones propias, útiles y claras.

### 21. Criterios de aceptación

Consideraré que la primera versión cumple si:

- se puede navegar desde la home hasta una ficha;
- el buscador devuelve recursos;
- el mapa muestra los recursos geolocalizados;
- las categorías funcionan;
- las fichas muestran contacto, fuente y actualización;
- se distinguen Poblado Dirigido y Orcasitas general;
- el formulario de participación guarda solicitudes pendientes;
- la web funciona correctamente en móvil;
- las páginas principales tienen metadatos SEO;
- no hay páginas prioritarias vacías;
- no se publican imágenes sin derechos acreditados.

### 22. Orden de construcción

Construye en este orden:

1. estructura base y navegación;
2. inicio;
3. página de Orcasitas;
4. página del Poblado Dirigido;
5. categorías;
6. modelo de datos;
7. fichas;
8. buscador y filtros;
9. mapa;
10. participación;
11. SEO técnico;
12. revisión responsive;
13. carga de datos iniciales;
14. pruebas y correcciones.

Antes de añadir nuevas funcionalidades, entrega una primera versión navegable con datos reales del archivo JSON.

### 23. Resultado esperado de esta primera iteración

Entrega una primera versión funcional y navegable del portal, aunque visualmente pueda ser provisional. Debe incluir datos reales del Poblado Dirigido, páginas de categorías, fichas, buscador, mapa y formulario de participación.

No publiques el proyecto ni lo consideres terminado sin una revisión posterior de contenidos, fuentes, imágenes, datos personales y SEO.

---

## Archivos adjuntos que debes utilizar

1. `INFORME-ARQUITECTURA-SEO-Y-BRIEF-LOVABLE.md`
2. `FASE-2-KEYWORD-RESEARCH-ARQUITECTURA-SEO.md`
3. `DATOS-MVP-LOVABLE.json`
4. `WIREFRAME-FUNCIONAL-MVP.md`
5. `INVENTARIO-MAESTRO-RECURSOS-MVP.md`
6. `INVENTARIO-MAESTRO-RECURSOS-MVP.csv`
7. `FICHAS-P1-CONTENIDOS-INICIALES.md`
8. `ESTUDIO-MVP-ORCASITAS.md`
9. `RECURSOS-VISUALES/REGISTRO-DERECHOS-IMAGENES.md`
10. `RECURSOS-VISUALES/registro-derechos-imagenes.csv`

### Carpeta de datos

Adjunta también, si Lovable permite cargar carpetas o archivos auxiliares:

- `datos-dinorank/`
- `datos-google-keyword-planner/`

Las exportaciones SEO son datos de investigación. No deben mostrarse públicamente en la web; sirven para decidir la arquitectura y las prioridades.

### Orden recomendado de adjuntos

1. Prompt maestro.
2. Informe de arquitectura y briefing.
3. JSON de datos.
4. Wireframe.
5. Inventario Markdown.
6. Inventario CSV.
7. Fichas P1.
8. Registro de imágenes.

Empieza construyendo el prototipo funcional con los datos del JSON y utiliza los demás documentos como contexto, reglas y criterios de validación.

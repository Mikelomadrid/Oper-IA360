# Wireframe funcional del MVP

## Portal local de Orcasitas

## 1. Objetivo

Definir la navegación y los componentes principales antes de construir el prototipo en Lovable.

## 2. Estructura general de navegación

```text
Cabecera
├── Logo / nombre del portal
├── Buscador
├── Explorar por categoría
├── Mapa
├── Actualidad
└── Participar

Contenido
└── Página actual

Pie
├── Sobre el proyecto
├── Fuentes y actualización
├── Contacto
├── Aviso legal y privacidad
└── Proponer corrección
```

## 3. Pantalla de inicio

```text
┌─────────────────────────────────────────────┐
│ Logo Portal Orcasitas     Mapa  Participar  │
├─────────────────────────────────────────────┤
│                                             │
│        ¿Qué buscas en Orcasitas?            │
│        [ Buscar colegio, farmacia... ]      │
│                                             │
├─────────────────────────────────────────────┤
│ Explora el barrio                           │
│ [Salud] [Educación] [Transporte] [Deporte] │
│ [Comercios] [Parques] [Asociaciones]        │
├─────────────────────────────────────────────┤
│ Elige una zona                              │
│ [Poblado Dirigido] [Meseta] [Orca Sur]      │
├─────────────────────────────────────────────┤
│ Recursos destacados                         │
│ [Tarjeta] [Tarjeta] [Tarjeta]               │
├─────────────────────────────────────────────┤
│ Mapa rápido del barrio                      │
│                  [Mapa]                     │
├─────────────────────────────────────────────┤
│ Actualidad vecinal       [Ver actualidad]  │
└─────────────────────────────────────────────┘
```

## 4. Página de zona

Ejemplo: `/poblado-dirigido-de-orcasitas/`

```text
Breadcrumbs: Inicio > Orcasitas > Poblado Dirigido

H1: Poblado Dirigido de Orcasitas
Descripción breve del barrio

[Ver mapa] [Buscar un recurso]

Categorías de la zona
[Salud] [Educación] [Transporte] [Deporte]
[Comercio] [Cultura] [Asociaciones]

Recursos destacados
[Ficha] [Ficha] [Ficha]

Plazas y espacios del barrio
[Mapa/listado]

Historia y actualidad
[Artículo] [Artículo]

Participa
[Proponer recurso] [Informar de un cambio]
```

## 5. Página de categoría

Ejemplo: `/orcasitas/servicios/salud/`

```text
Breadcrumbs
H1: Salud en Orcasitas
Introducción SEO y práctica

Filtros:
[Subzona] [Tipo de recurso] [Accesibilidad]

┌──────────────────────┬──────────────────────┐
│ Lista de recursos    │ Mapa                  │
│ [Ficha]              │                       │
│ [Ficha]              │       [Mapa]          │
│ [Ficha]              │                       │
└──────────────────────┴──────────────────────┘

Preguntas frecuentes
Enlaces a categorías relacionadas
Fecha de actualización
```

## 6. Ficha de recurso

Ejemplo: Centro de Salud Orcasitas

```text
Breadcrumbs

H1: Centro de Salud Orcasitas
Etiqueta: Verificado
Categoría: Salud

Descripción

┌─────────────────────────────────────────────┐
│ Dirección                                   │
│ Teléfono [Llamar]                           │
│ Horario                                     │
│ [Cómo llegar] [Abrir mapa]                  │
└─────────────────────────────────────────────┘

Servicios
Accesibilidad
Transporte cercano
Recursos relacionados

Fuente: Comunidad de Madrid
Última comprobación: fecha

[Informar de un cambio]
```

## 7. Ficha de comercio

```text
H1: Nombre del comercio
Estado: Verificado / Pendiente de actualización

Foto principal
Descripción
Categoría
Servicios
Dirección
Horario
Teléfono
Web / redes
Mapa

¿Eres responsable de este negocio?
[Solicitar actualización de ficha]
```

## 8. Página de transporte

```text
H1: Transporte en Orcasitas

Accesos rápidos:
[Autobuses] [Cercanías] [Metro cercano]

Mapa de paradas

Listado:
Línea / parada / destino / horario / fuente

Aviso: comprobar horarios en la fuente oficial
```

## 9. Mapa general

```text
┌─────────────────────────────────────────────┐
│ Buscar en el mapa                            │
│ [Categoría] [Zona] [Solo verificados]        │
├─────────────────────────────────────────────┤
│                                             │
│                    MAPA                     │
│                                             │
│  Leyenda: salud / educación / comercio      │
│           deporte / transporte / cultura    │
├─────────────────────────────────────────────┤
│ Lista de resultados cercanos                 │
└─────────────────────────────────────────────┘
```

## 10. Página de participación

```text
H1: Participa en el portal

¿Qué quieres enviar?
( ) Nuevo recurso
( ) Corrección de datos
( ) Actividad o evento
( ) Fotografía histórica
( ) Propuesta de contenido

Nombre del recurso
Mensaje
Enlace o fuente
Correo opcional
Adjuntar imagen, si procede

[Enviar propuesta]
```

## 11. Estados de información

La interfaz debe mostrar claramente:

- **Verificado:** confirmado por fuente oficial o titular.
- **Pendiente de actualización:** existe, pero requiere revisión reciente.
- **En obras:** recurso o espacio afectado por actuaciones.
- **Servicio cercano:** está fuera del núcleo del Poblado, pero es útil para sus vecinos.
- **No publicar:** ficha interna con información insuficiente.

## 12. Flujos principales

### Flujo A — Buscar un servicio

```text
Inicio → buscador → resultados → ficha → llamar / llegar / compartir
```

### Flujo B — Explorar una categoría

```text
Inicio → categoría → filtros → listado/mapa → ficha
```

### Flujo C — Explorar una zona

```text
Inicio → Poblado Dirigido → categorías → recursos → mapa
```

### Flujo D — Corregir información

```text
Ficha → Informar de un cambio → formulario → revisión interna → actualización
```

### Flujo E — Encontrar un negocio

```text
Inicio → Comercios → categoría → negocio → contacto / cómo llegar
```

## 13. Requisitos responsive

### Móvil

- Buscador visible al inicio.
- Botón de mapa accesible.
- Tarjetas a una columna.
- Teléfono y cómo llegar destacados.
- Filtros desplegables.

### Escritorio

- Listado y mapa en paralelo.
- Navegación completa.
- Filtros laterales.
- Mayor densidad de información.

## 14. Componentes para Lovable

- `Header`
- `SearchBar`
- `ZoneSelector`
- `CategoryGrid`
- `ResourceCard`
- `ResourceList`
- `MapView`
- `FilterPanel`
- `VerificationBadge`
- `SourceAndUpdate`
- `RelatedResources`
- `CorrectionForm`
- `Footer`

## 15. Criterio de diseño

La interfaz debe transmitir proximidad, confianza y utilidad. La prioridad visual debe ser:

1. Encontrar.
2. Entender.
3. Llegar o contactar.
4. Corregir o aportar información.

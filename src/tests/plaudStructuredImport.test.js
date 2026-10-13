import { describe, expect, it } from 'vitest';
import { mapPlaudPayloadToBudget, parsePlaudStructuredMarkdown, rankSystemCandidates } from '@/lib/plaudStructuredImport';

const payload = {
  schema_version: 'orkaled_visita_1.0',
  visita: { cliente: 'Yani', objeto_trabajos: 'Reforma parcial de cocina.' },
  partidas: [
    {
      secuencia: 1,
      fase_orden: 3,
      titulo: 'Picado y levantado de suelo existente',
      descripcion: 'Picado de pavimento cerámico existente.',
      estado: 'confirmada',
      origen: 'cliente',
      estancia: 'Cocina',
      unidad: 'm²',
      cantidad: null,
      medicion_pendiente: true,
      texto_origen: 'Hay que picar el suelo.',
      confianza: 0.95,
    },
    {
      secuencia: 2,
      fase_orden: 5,
      titulo: 'Renovación de fontanería',
      descripcion: 'Renovación de tres puntos de fontanería.',
      estado: 'confirmada',
      origen: 'cliente',
      estancia: 'Cocina',
      unidad: 'ud',
      cantidad: 3,
      medicion_pendiente: false,
      texto_origen: 'Fregadero, lavavajillas y nevera.',
      confianza: 1,
    },
  ],
  mediciones: [{
    id_temporal: 'M-001',
    estancia: 'Cocina',
    elemento: 'Superficie de pavimento',
    cantidad: null,
    unidad: 'm²',
    uso_previsto: ['Picado de suelo'],
    estado: 'pendiente',
  }],
  decisiones_pendientes: [{ id_temporal: 'D-001', nivel: 'bloqueante', pregunta: '¿Cuántos m² hay?', partidas_afectadas: [1] }],
  partidas_sugeridas: [{ titulo: 'Contenedor', fase_orden: 2 }],
  trabajos_excluidos: [],
  trabajos_terceros: [],
  materiales_calidades: [],
  contradicciones: [],
  referencias_economicas: [],
};

describe('importación estructurada de PLAUD', () => {
  it('extrae JSON válido aunque PLAUD no cierre el bloque Markdown', () => {
    const markdown = `# Informe\n- **Cliente:** Yani / Janin\n# 16. BLOQUE ESTRUCTURADO\n\`\`\`json\n${JSON.stringify(payload, null, 2)}`;
    const parsed = parsePlaudStructuredMarkdown(markdown);

    expect(parsed.detected).toBe(true);
    expect(parsed.payload.partidas).toHaveLength(2);
    expect(parsed.warnings).toHaveLength(2);
  });

  it('no confunde una transcripción normal con un informe estructurado', () => {
    expect(parsePlaudStructuredMarkdown('Cliente: queremos reformar la cocina.').detected).toBe(false);
  });

  it('convierte partidas, mediciones y decisiones al modelo de revisión del ERP', () => {
    const systems = [{ id: 'sys-1', codigo: '9.2.01', nombre: 'Picado y levantado de pavimento cerámico', capitulo: 'Demoliciones', unidad_base: 'm²' }];
    const mapped = mapPlaudPayloadToBudget(payload, systems);

    expect(mapped.result.partidas).toHaveLength(2);
    expect(mapped.result.partidas[0]).toMatchObject({
      sistema_id: null,
      sistema_sugerido_id: 'sys-1',
      vinculacion_confirmada: false,
      fase_ejecucion: 'demoliciones',
      medicion_id: 'M-001',
    });
    expect(mapped.result.partidas[0].candidatos_biblioteca[0]).toMatchObject({ system_id: 'sys-1', codigo: '9.2.01' });
    expect(mapped.result.partidas[1]).toMatchObject({ cantidad: 3, fase_ejecucion: 'instalaciones' });
    expect(mapped.result.datos_pendientes[0]).toMatchObject({ estado: 'pendiente', nivel: 'bloqueante' });
    expect(mapped.summary).toMatchObject({ partidas: 2, mediciones: 1, decisiones: 1, sugeridas: 1, sistemasVinculados: 0, sistemasConCandidatos: 1 });
  });

  it('ordena hasta tres coincidencias usando texto, capítulo y unidad', () => {
    const systems = [
      { id: 'sys-1', codigo: '9.2.01', nombre: 'Picado y levantado de pavimento cerámico', capitulo: 'Demoliciones', unidad_base: 'm²' },
      { id: 'sys-2', codigo: '9.2.02', nombre: 'Picado de alicatado cerámico', capitulo: 'Demoliciones', unidad_base: 'm²' },
      { id: 'sys-3', codigo: '7.1.01', nombre: 'Solado con pavimento cerámico', capitulo: 'Revestimientos', unidad_base: 'm²' },
      { id: 'sys-4', codigo: '3.1.01', nombre: 'Línea eléctrica independiente', capitulo: 'Electricidad', unidad_base: 'ud' },
    ];

    const candidates = rankSystemCandidates(payload.partidas[0], systems);

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ system_id: 'sys-1' });
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
  });
});

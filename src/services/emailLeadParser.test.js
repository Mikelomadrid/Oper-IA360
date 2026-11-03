import { describe, expect, it } from 'vitest';
import { classifyLeadSource, parseLeadEmail } from './emailLeadParser';

describe('emailLeadParser', () => {
  it('clasifica OrkaLED como Web y extrae los campos estándar', () => {
    const lead = parseLeadEmail({
      subject: 'Solicitud de Presupuesto Web',
      from: 'Miguel Ángel de Juan <miguel@orkaled.com>',
      date: '2026-10-23T15:41:00Z',
      body: `SOLICITUD DE PRESUPUESTO ONLINE\nDe: Félix\nCorreo: felix@example.com\nTeléfono: 607311436\nCuerpo del mensaje: Reforma integral\n--\nEsto es un aviso de que se ha enviado un formulario de contacto en tu web (Reformas Orkaled https://orkaled.com).`,
    });

    expect(lead.source).toBe('Web');
    expect(lead.nombre_contacto).toBe('Félix');
    expect(lead.email).toBe('felix@example.com');
    expect(lead.telefono).toBe('607311436');
    expect(lead.comentario).toBe('Reforma integral');
    expect(lead.estado_importacion).toBe('listo');
  });

  it('clasifica OYRSA dentro de Maestro Fontanero y conserva adjuntos', () => {
    const lead = parseLeadEmail({
      subject: 'Solicitud Presupuesto Viviendas Brunete',
      from: 'Carmen <carmen@oyrsa.es>',
      body: 'Solicitud de presupuesto para viviendas en Brunete',
      attachments: [
        { filename: 'planos-brunete.pdf', mime: 'application/pdf', sizeBytes: 1200 },
        { filename: 'foto.jpg', mime: 'image/jpeg', sizeBytes: 800 },
      ],
    });

    expect(lead.source).toBe('Maestro Fontanero');
    expect(lead.estado_importacion).toBe('revision');
    expect(lead.tiene_adjuntos).toBe(true);
    expect(lead.adjuntos.map((file) => file.tipo)).toEqual(['doc', 'foto']);
  });

  it('extrae el formato de formulario de Maestro Fontanero', () => {
    const lead = parseLeadEmail({
      subject: 'Nuevo mensaje desde «Maestro Fontanero»',
      from: 'Maestro Fontanero <email@maestrofontanero.es>',
      body: `Nombre: Héctor\nDéjanos tu mejor email: hector@example.com\nTeléfono de contacto: 618157277\nEn que podemos ayudarte: Se ha roto un tubo de la caldera.\nPolíticas de privacidad: on`,
    });

    expect(lead.source).toBe('Maestro Fontanero');
    expect(lead.email).toBe('hector@example.com');
    expect(lead.telefono).toBe('618157277');
    expect(lead.comentario).toBe('Se ha roto un tubo de la caldera.');
    expect(lead.estado_importacion).toBe('listo');
  });

  it('marca respuestas y teléfonos extranjeros para revisión', () => {
    const lead = parseLeadEmail({
      subject: 'Re: Solicitud de Presupuesto Web',
      from: 'cliente@example.com',
      body: 'Correo: cliente@example.com\nTeléfono: +441234567890\nCuerpo del mensaje: Seguimiento',
    });

    expect(lead.source).toBe('Web');
    expect(lead.estado_importacion).toBe('revision');
    expect(lead.motivos_revision).toEqual(expect.arrayContaining([
      'posible_respuesta',
      'telefono_sospechoso',
    ]));
  });

  it('marca contenido promocional en inglés como spam', () => {
    const lead = parseLeadEmail({
      subject: 'SEO services',
      from: 'sales@example.com',
      body: 'Dear sir, we offer backlink and guest post services.',
    });

    expect(lead.source).toBe(null);
    expect(lead.estado_importacion).toBe('spam');
    expect(lead.motivos_revision).toContain('posible_spam');
  });

  it('mantiene la regla de clasificación explícita', () => {
    expect(classifyLeadSource({ from: 'Carmen <carmen@oyrsa.es>' })).toBe('Maestro Fontanero');
    expect(classifyLeadSource({ body: 'Reformas Orkaled https://orkaled.com' })).toBe('Web');
  });
});

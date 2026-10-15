import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn(async () => ({ data: { id: 'mail-test' }, error: null })), list: vi.fn(async () => ({ data: { data: [{ name: 'mail.circulointernacionalveracruz.org', status: 'verified' }] }, error: null })) }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; domains = { list: mocks.list }; } }));
vi.mock('./config.js', () => ({ config: { resendApiKey: 'test-only', emailFrom: 'Círculo <invalid@gmail.com>', advisorEmails: ['patyestr@hotmail.com', 'circulointernacionalveracruz1@gmail.com'] } }));
import { buildAdvisorReport, sendAdvisorEmail } from './email.js';
import { leadSchema } from './schemas.js';
import { lead, property, snapshot } from './testFixtures.js';

describe('reporte de contacto', () => {
  it('envía a ambos asesores desde el dominio verificado, con las ligas seleccionadas', async () => {
    const search = snapshot();
    await sendAdvisorEmail('lead-test', lead, search, search.matches);
    const [payload, options] = mocks.send.mock.calls[0] as unknown as [{ to: string[]; from: string; text: string; replyTo: string }, { idempotencyKey: string }];
    expect(payload.to).toEqual(['patyestr@hotmail.com', 'circulointernacionalveracruz1@gmail.com']);
    expect(payload.from).toContain('@mail.circulointernacionalveracruz.org');
    expect(payload.text).toContain(property.sourceUrl);
    expect(payload.replyTo).toBe(lead.email);
    expect(options.idempotencyKey).toBe('contact-lead-test');
  });
  it('no incluye ligas de propiedades no seleccionadas y escapa texto del cliente', () => {
    const search = snapshot();
    search.matches.push({ ...search.matches[0], id: 'other', sourceUrl: 'https://example.com/no-seleccionada' });
    const report = buildAdvisorReport('id', { ...lead, fullName: '<script>texto</script>' }, search, [search.matches[0]]);
    expect(report.html).toContain('&lt;script&gt;');
    expect(report.html).not.toContain('<script>');
    expect(report.text).not.toContain('no-seleccionada');
  });
  it('incluye mascotas, fiador y póliza jurídica de las rentas en el informe', () => {
    const rental = leadSchema.parse({ ...lead, transactionType: 'rent', hasPets: true, petCount: 2, petType: 'Gatos', hasGuarantor: true, hasLegalPolicy: true });
    const report = buildAdvisorReport('renta', rental, snapshot(), []);
    expect(report.text).toContain('Tengo mascota: 2 · Gatos');
    expect(report.text).toContain('Tengo fiador: Sí');
    expect(report.text).toContain('Cuento con póliza jurídica: Sí');
    expect(report.html).toContain('Cuento con póliza jurídica');
    const purchaseReport = buildAdvisorReport('compra', lead, snapshot(), []);
    expect(purchaseReport.text).not.toContain('Cuento con póliza jurídica');
  });
  it('distingue las declaraciones del cliente de las condiciones pendientes de confirmar', () => {
    const rental = leadSchema.parse({ ...lead, transactionType: 'rent', hasPets: true, petCount: 2, petType: '<Perro y gato>', hasGuarantor: false, hasLegalPolicy: true });
    const report = buildAdvisorReport('rental', rental, { ...snapshot(), criteria: rental }, []);
    expect(report.text).toContain('Tengo mascota: 2 · <Perro y gato>');
    expect(report.text).toContain('Tengo fiador: No');
    expect(report.text).toContain('Cuento con póliza jurídica: Sí');
    expect(report.html).toContain('&lt;Perro y gato&gt;');
    expect(report.html).not.toContain('<Perro y gato>');
    for (const format of [report.html, report.text]) {
      expect(format).toContain('declaraciones del cliente');
      expect(format).toContain('pendientes de confirmar con la fuente');
      expect(format).not.toContain('Forma de pago');
      expect(format).not.toContain('Crédito preaprobado');
    }
  });
  it('no incluye datos ocultos de mascotas después de deseleccionar', () => {
    const rental = leadSchema.parse({ ...lead, transactionType: 'rent', hasPets: false, petCount: 2, petType: 'Dato anterior', hasGuarantor: true, hasLegalPolicy: false });
    const report = buildAdvisorReport('rental', rental, { ...snapshot(), criteria: rental }, []);
    expect(report.text).toContain('Tengo mascota: No');
    expect(report.text).toContain('Tengo fiador: Sí');
    expect(report.text).toContain('Cuento con póliza jurídica: No');
    expect(report.text).not.toContain('Dato anterior');
  });
  it('conserva pago y crédito en compra y no incluye filas de renta ni datos antiguos', () => {
    const purchase = leadSchema.parse({ ...lead, hasPets: true, petCount: 3, petType: 'Gatos', hasGuarantor: true, hasLegalPolicy: true });
    const report = buildAdvisorReport('purchase', purchase, snapshot(), []);
    for (const format of [report.html, report.text]) {
      expect(format).not.toContain('Tengo mascota');
      expect(format).not.toContain('Tengo fiador');
      expect(format).not.toContain('Cuento con póliza jurídica');
      expect(format).not.toContain('Inquilinos / contrato');
      expect(format).toContain('Forma de pago');
      expect(format).toContain('Crédito preaprobado');
    }
  });
});

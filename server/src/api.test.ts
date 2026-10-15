import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { criteria, lead, property } from './testFixtures.js';
const mocks = vi.hoisted(() => ({ inventory: vi.fn(), send: vi.fn() }));
vi.mock('./config.js', () => ({ config: { nodeEnv: 'test', sessionSecret: 'unit-test-signing-key', supabaseUrl: '', supabaseServiceRoleKey: '', openaiModel: 'test' }, isProduction: false }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./providers.js', () => ({ collectProviderInventory: mocks.inventory, checkProviderSources: vi.fn() }));
vi.mock('./email.js', () => ({ sendAdvisorEmail: mocks.send, sendTestEmail: vi.fn(), getEmailConfigurationStatus: vi.fn(async () => ({ configured: true })) }));
import { app } from './index.js';
import { getLeadForConfirmation } from './repository.js';
import { signSearch } from './searchSession.js';
let server: Server, base: string;
beforeAll(async () => { server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port'); base = 'http://127.0.0.1:' + address.port; });
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function search(properties = [property], criteriaInput = criteria) {
  mocks.inventory.mockResolvedValue({ properties, sourcesConsulted: 1, warnings: [] });
  const response = await post('/api/searches', { ...criteriaInput, fullName: 'No enviar', email: 'private@example.com' });
  expect(response.status).toBe(200);
  return response.json();
}
const contact = { fullName: lead.fullName, email: lead.email, phone: lead.phone, privacyAccepted: true, contactAccepted: true, website: '' };
describe('flujo de consulta y contacto explícito', () => {
  it('consulta sin datos personales, sin guardar leads y sin enviar correos', async () => {
    mocks.send.mockClear();
    const data = await search();
    expect(data.criteria).not.toHaveProperty('fullName');
    expect(data.criteria).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('leadId');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('requiere consentimiento y rechaza selecciones ajenas', async () => {
    const data = await search();
    const path = '/api/searches/' + data.searchId + '/contact';
    expect((await post(path, { contactToken: data.contactToken, selectedPropertyIds: [], contact: { ...contact, contactAccepted: false } })).status).toBe(422);
    expect((await post(path, { contactToken: data.contactToken, selectedPropertyIds: ['foreign'], contact })).status).toBe(422);
  });
  it('permite pedir ayuda sin resultados y evita duplicar el envío', async () => {
    mocks.send.mockReset().mockResolvedValue({ sent: true });
    const data = await search([]);
    const path = '/api/searches/' + data.searchId + '/contact';
    const body = { contactToken: data.contactToken, selectedPropertyIds: [], contact };
    expect((await post(path, body)).status).toBe(200);
    const second = await (await post(path, body)).json();
    expect(second.duplicate).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][3]).toEqual([]);
  });
  it('no anuncia éxito si falla el correo y permite reintentar la misma solicitud', async () => {
    mocks.send.mockReset().mockRejectedValueOnce(new Error('fallo simulado')).mockResolvedValue({ sent: true });
    const data = await search();
    const path = '/api/searches/' + data.searchId + '/contact';
    const body = { contactToken: data.contactToken, selectedPropertyIds: [property.id], contact };
    const failed = await post(path, body);
    expect(failed.status).toBe(503);
    expect((await failed.json()).confirmed).toBe(false);
    expect((await post(path, body)).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])('lleva mascotas, fiador %s y póliza %s desde consulta firmada hasta reporte y persistencia', async (hasGuarantor, hasLegalPolicy) => {
    mocks.send.mockReset().mockResolvedValue({ sent: true });
    const rentalCriteria = { ...criteria, transactionType: 'rent' as const, hasPets: true, petCount: 2, petType: '  Perro y gato  ', hasGuarantor, hasLegalPolicy };
    const data = await search([{ ...property, transactionType: 'rent' }], rentalCriteria);
    const expected = { hasPets: true, petCount: 2, petType: 'Perro y gato', hasGuarantor, hasLegalPolicy };
    expect(data.criteria).toMatchObject(expected);
    expect(data.criteria).not.toHaveProperty('guarantee');
    expect(data.analysis.explanation).toContain('no están verificadas');
    expect(data.warnings).toEqual([]);
    const response = await post('/api/searches/' + data.searchId + '/contact', { contactToken: data.contactToken, selectedPropertyIds: [property.id], contact });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect((await getLeadForConfirmation(result.leadId))?.lead).toMatchObject(expected);
    expect(mocks.send.mock.calls[0][1]).toMatchObject(expected);
  });
  it('no transmite respuestas de renta antiguas en una consulta o reporte de compra', async () => {
    mocks.send.mockReset().mockResolvedValue({ sent: true });
    const data = await search([property], { ...criteria, hasPets: true, petCount: 2, petType: 'Gatos', petDetails: 'Dato anterior', hasGuarantor: true, hasLegalPolicy: true });
    const expected = { hasPets: false, petCount: 0, petType: '', petDetails: '', hasGuarantor: false, hasLegalPolicy: false };
    expect(data.criteria).toMatchObject(expected);
    const response = await post('/api/searches/' + data.searchId + '/contact', { contactToken: data.contactToken, selectedPropertyIds: [], contact });
    expect(response.status).toBe(200);
    expect(mocks.send.mock.calls[0][1]).toMatchObject(expected);
  });
  it.each([0, true, '2'])('rechaza cantidad %s antes de consultar anuncios', async petCount => {
    mocks.inventory.mockClear();
    const invalid = await post('/api/searches', { ...criteria, transactionType: 'rent', hasPets: true, petCount, petType: 'Perro' });
    expect(invalid.status).toBe(422);
    expect(mocks.inventory).not.toHaveBeenCalled();
  });
  it('permite deseleccionar mascotas aunque haya valores ocultos inválidos', async () => {
    const data = await search([], { ...criteria, transactionType: 'rent', hasPets: false, petCount: -1, petType: 'Dato anterior' });
    expect(data.criteria).toMatchObject({ hasPets: false, petCount: 0, petType: '' });
  });
  it('pide actualizar una consulta firmada antigua sin inventar cantidad ni tipo desde texto', async () => {
    mocks.send.mockClear();
    const data = await search([]);
    const legacyToken = signSearch({ ...data, criteria: { ...data.criteria, transactionType: 'rent', hasPets: true, petDetails: '2 perros', petCount: undefined, petType: undefined } });
    const response = await post('/api/searches/' + data.searchId + '/contact', { contactToken: legacyToken, selectedPropertyIds: [], contact });
    expect(response.status).toBe(410);
    expect((await response.json()).error).toContain('Actualiza la búsqueda');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

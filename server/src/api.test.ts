import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { criteria, lead, property } from './testFixtures.js';
const mocks = vi.hoisted(() => ({ inventory: vi.fn(), send: vi.fn() }));
vi.mock('./providers.js', () => ({ collectProviderInventory: mocks.inventory, checkProviderSources: vi.fn() }));
vi.mock('./email.js', () => ({ sendAdvisorEmail: mocks.send, sendTestEmail: vi.fn(), getEmailConfigurationStatus: vi.fn(async () => ({ configured: true })) }));
import { app } from './index.js';
let server: Server, base: string;
beforeAll(async () => { server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port'); base = 'http://127.0.0.1:' + address.port; });
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function search(properties = [property]) {
  mocks.inventory.mockResolvedValue({ properties, sourcesConsulted: 1, warnings: [] });
  const response = await post('/api/searches', { ...criteria, fullName: 'No enviar', email: 'private@example.com' });
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
});

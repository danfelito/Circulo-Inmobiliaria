import { describe, expect, it, vi } from 'vitest';
vi.mock('./config.js', () => ({ config: { crmInquiryUrl: 'https://crm.example.test/api/inquiries' } }));
import { buildCrmInquiry, crmRequestId, syncLeadToCrm } from './crm.js';
import { lead } from './testFixtures.js';

const response = (status: number) => new Response(status === 201 ? '{"id":"inq_x"}' : '{"error":"x"}', { status });

describe('sincronización con el CRM de Círculo', () => {
  it('usa un requestId estable con formato aceptado por el CRM', () => {
    expect(crmRequestId('search-1')).toBe(crmRequestId('search-1'));
    expect(crmRequestId('search-1')).not.toBe(crmRequestId('search-2'));
    expect(crmRequestId('search-1')).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('envía nombre, contacto, reporte y atribución del buscador', async () => {
    const fetchMock = vi.fn(async () => response(201));
    const result = await syncLeadToCrm('search-1', { ...lead, email: '' }, 'Reporte', fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ synced: true, status: 201 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://crm.example.test/api/inquiries');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ requestId: crmRequestId('search-1'), name: lead.fullName, email: '', phone: lead.phone, attribution: { utm_source: 'buscador' } });
    expect(body.message).toContain('Reporte');
  });
  it('trata un 409 como ya registrado y nunca lanza ante fallos', async () => {
    expect((await syncLeadToCrm('s', lead, 'r', (async () => response(409)) as unknown as typeof fetch)).synced).toBe(true);
    expect((await syncLeadToCrm('s', lead, 'r', (async () => response(500)) as unknown as typeof fetch)).synced).toBe(false);
    expect((await syncLeadToCrm('s', lead, 'r', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).synced).toBe(false);
  });
  it('limita el mensaje a 5000 caracteres', () => {
    expect(buildCrmInquiry('s', lead, 'x'.repeat(9000)).message.length).toBe(5000);
  });
});

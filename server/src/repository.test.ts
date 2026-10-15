import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { criteriaSchema, leadSchema } from './schemas.js';
import { readSearch, signSearch } from './searchSession.js';
import { snapshot } from './testFixtures.js';

const database = vi.hoisted(() => ({
  leadRows: new Map<string, Record<string, unknown>>(),
  searchRows: [] as Record<string, unknown>[],
  resultRows: [] as Record<string, unknown>[],
  nextLeadId: 0,
}));
const services = vi.hoisted(() => ({
  inventory: vi.fn(async () => ({ properties: [], sourcesConsulted: 1, warnings: [] })),
  send: vi.fn(async () => ({ sent: true, id: 'mock-email' })),
}));

vi.mock('./config.js', () => ({
  config: {
    supabaseUrl: 'https://repository-test.invalid',
    supabaseServiceRoleKey: 'mock-only-key',
    nodeEnv: 'test',
    sessionSecret: 'mock-only-session-secret',
    openaiModel: 'mock-only-model',
  },
  isProduction: false,
}));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('./providers.js', () => ({ collectProviderInventory: services.inventory, checkProviderSources: vi.fn() }));
vi.mock('./email.js', () => ({
  sendAdvisorEmail: services.send, sendTestEmail: vi.fn(),
  getEmailConfigurationStatus: vi.fn(async () => ({ configured: true })),
}));

// Store JSON copies to exercise the repository's database path without any
// credentials, remote database access, provider requests, or actual email sends.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'leads') return {
        select: () => ({ eq: (field: string, value: string) => ({
          maybeSingle: async () => ({
            data: [...database.leadRows.values()].find(row => row[field] === value) ?? null,
            error: null,
          }),
        }) }),
        insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => {
          const stored = JSON.parse(JSON.stringify({ id: `lead-${++database.nextLeadId}`, ...row })) as Record<string, unknown>;
          database.leadRows.set(String(stored.id), stored);
          return { data: stored, error: null };
        } }) }),
        update: (values: Record<string, unknown>) => ({ eq: async (field: string, value: string) => {
          const row = [...database.leadRows.values()].find(item => item[field] === value);
          if (row) Object.assign(row, JSON.parse(JSON.stringify(values)));
          return { error: null };
        } }),
      };
      if (table === 'searches') return {
        insert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => {
          const stored = JSON.parse(JSON.stringify({ id: `search-${database.searchRows.length + 1}`, ...row })) as Record<string, unknown>;
          database.searchRows.push(stored);
          return { data: stored, error: null };
        } }) }),
      };
      if (table === 'search_results') return {
        insert: async (rows: Record<string, unknown>[]) => {
          database.resultRows.push(...JSON.parse(JSON.stringify(rows)) as Record<string, unknown>[]);
          return { error: null };
        },
      };
      throw new Error(`Unexpected test table: ${table}`);
    }),
  })),
}));

function rentalLead(hasGuarantor = true, hasLegalPolicy = true) {
  return leadSchema.parse({
    transactionType: 'rent', propertyType: 'house', city: 'Boca del Río', budgetMin: 10_000, budgetMax: 25_000,
    hasPets: true, petCount: 2, petType: 'Un perro y un gato', hasGuarantor, hasLegalPolicy,
    fullName: 'Prueba de persistencia', phone: '2290000000', email: 'persistencia@example.com',
    privacyAccepted: true, contactAccepted: true,
  });
}
const rentalSelection = {
  hasPets: true, petCount: 2, petType: 'Un perro y un gato', hasGuarantor: true, hasLegalPolicy: true,
};

let server: Server, baseUrl: string;
beforeAll(async () => {
  const { app } = await import('./index.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  database.leadRows.clear();
  database.searchRows.length = 0;
  database.resultRows.length = 0;
  services.send.mockClear();
  vi.resetModules();
});

describe('persistencia de los datos de renta', () => {
  it.each([[true, true], [true, false], [false, true], [false, false]])(
    'conserva fiador=%s y póliza=%s independientemente en los JSON de lead y búsqueda',
    async (hasGuarantor, hasLegalPolicy) => {
      const { saveLead, saveSearch } = await import('./repository.js');
      const lead = rentalLead(hasGuarantor, hasLegalPolicy);
      const stored = await saveLead(lead, `rental-persistence-${hasGuarantor}-${hasLegalPolicy}`);
      await saveSearch(stored.id, lead, { advisorSummary: 'Solicitud de renta' }, []);

      const expected = { ...rentalSelection, hasGuarantor, hasLegalPolicy };
      expect(database.leadRows.get(stored.id)?.payload).toMatchObject(expected);
      expect(database.searchRows[0]?.criteria).toMatchObject(expected);
    },
  );

  it('recupera los datos de renta al leer un lead persistido tras un reinicio', async () => {
    const { getLeadForConfirmation } = await import('./repository.js');
    const original = snapshot();
    database.leadRows.set('persisted-rental-lead', {
      id: 'persisted-rental-lead', idempotency_key: 'persisted-rental-key', payload: rentalLead(),
      response_payload: { analysis: original.analysis, matches: [], confirmationSent: false, selectedPropertyIds: [] },
    });

    const confirmation = await getLeadForConfirmation('persisted-rental-lead');
    expect(confirmation?.lead).toMatchObject(rentalSelection);
  });

  it('conserva los tres controles en la consulta firmada que se convierte en lead', () => {
    const original = { ...snapshot(), criteria: criteriaSchema.parse(rentalLead()) };
    const restored = readSearch(signSearch(original), original.searchId);
    expect(restored?.criteria).toMatchObject(rentalSelection);
    expect(restored?.criteria).not.toHaveProperty('email');
    expect(restored?.criteria).not.toHaveProperty('phone');
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    'lleva fiador=%s y póliza=%s desde la API y consulta firmada hasta el lead, reporte y búsqueda persistidos',
    async (hasGuarantor, hasLegalPolicy) => {
      const post = (path: string, body: unknown) => fetch(baseUrl + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const lead = rentalLead(hasGuarantor, hasLegalPolicy);
      const criteria = criteriaSchema.parse(lead);
      const searchResponse = await post('/api/searches', criteria);
      expect(searchResponse.status).toBe(200);
      const search = await searchResponse.json();
      expect(database.leadRows.size).toBe(0);
      expect(services.send).not.toHaveBeenCalled();

      const contactResponse = await post(`/api/searches/${search.searchId}/contact`, {
        contactToken: search.contactToken, selectedPropertyIds: [],
        contact: { fullName: lead.fullName, phone: lead.phone, email: lead.email, privacyAccepted: true, contactAccepted: true },
      });
      expect(contactResponse.status).toBe(200);
      const contactResult = await contactResponse.json();
      const expected = { ...rentalSelection, hasGuarantor, hasLegalPolicy };
      expect(database.leadRows.get(contactResult.leadId)?.payload).toMatchObject(expected);
      expect(database.searchRows[0]?.criteria).toMatchObject(expected);
      expect(database.leadRows.get(contactResult.leadId)?.response_payload).toMatchObject({ confirmationSent: true });
      expect(services.send).toHaveBeenCalledExactlyOnceWith(contactResult.leadId, expect.objectContaining(expected), expect.anything(), []);
    },
  );
});

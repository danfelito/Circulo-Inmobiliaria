import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaults, normalizeRentalFields, restoreDraft, schema } from '../../client/src/formConfig.js';
import { submitSearch } from '../../client/src/api.js';
import { criteriaSchema } from './schemas.js';

const valid = { ...defaults, city: 'Boca del Río', budgetMax: 25000 };
const toCriteria = (form: typeof valid) => ({ ...form, neighborhoods: [], essentialFeatures: [], desirableFeatures: [] });
afterEach(() => vi.unstubAllGlobals());

describe('formulario de renta, borradores y contrato frontend/backend', () => {
  it('inicia con las casillas deseleccionadas y la cantidad vacía', () => {
    expect(restoreDraft(null)).toMatchObject({ hasPets: false, petCount: undefined, petType: '', hasGuarantor: false, hasLegalPolicy: false });
  });
  it.each(['guarantor', 'legal_policy', 'deposit', 'advice'])('migra un borrador antiguo %s sin adivinar la cantidad ni perder los filtros', guarantee => {
    const saved = { ...valid, hasPets: true, petDetails: 'Dos perros medianos', guarantee, fullName: 'No restaurar', email: 'private@example.com' } as Record<string, unknown>;
    delete saved.hasGuarantor;
    delete saved.hasLegalPolicy;
    delete saved.petType;
    delete saved.petCount;
    const restored = restoreDraft(saved);
    expect(restored).toMatchObject({ city: valid.city, budgetMax: valid.budgetMax, bedrooms: valid.bedrooms, hasPets: true, petCount: undefined, petType: saved.petDetails, hasGuarantor: guarantee === 'guarantor', hasLegalPolicy: guarantee === 'legal_policy' });
    expect(restored).not.toHaveProperty('guarantee');
    expect(restored).not.toHaveProperty('petDetails');
    expect(restored).not.toHaveProperty('email');
    expect(schema.safeParse(restored).success).toBe(false);
  });
  it('respeta ambos valores explícitos y permite deseleccionar una garantía migrada', () => {
    expect(restoreDraft({ ...valid, hasGuarantor: true, hasLegalPolicy: true })).toMatchObject({ hasGuarantor: true, hasLegalPolicy: true });
    expect(restoreDraft({ ...valid, guarantee: 'guarantor', hasGuarantor: false })).toMatchObject({ hasGuarantor: false, hasLegalPolicy: false });
  });
  it('limpia los datos de mascota al deseleccionarla y todos los controles al comprar', () => {
    const rental = { ...valid, hasPets: true, petCount: 2, petType: 'Perros', hasGuarantor: true, hasLegalPolicy: true };
    expect(normalizeRentalFields({ ...rental, hasPets: false })).toMatchObject({ hasPets: false, petCount: undefined, petType: '', hasGuarantor: true, hasLegalPolicy: true });
    expect(restoreDraft({ ...rental, transactionType: 'buy' })).toMatchObject({ hasPets: false, petCount: undefined, petType: '', hasGuarantor: false, hasLegalPolicy: false });
  });
  it.each([undefined, 0, -1, 1.5, 31, true, '2', Number.NaN])('rechaza cantidad %s en ambos esquemas cuando hay mascota', petCount => {
    const value = { ...valid, hasPets: true, petCount, petType: 'Perros' };
    expect(schema.safeParse(value).success).toBe(false);
    expect(criteriaSchema.safeParse({ ...value, neighborhoods: [], essentialFeatures: [], desirableFeatures: [] }).success).toBe(false);
  });
  it.each(['', '   ', 'p'.repeat(121)])('rechaza tipo vacío o demasiado largo en ambos esquemas', petType => {
    const value = { ...valid, hasPets: true, petCount: 2, petType };
    expect(schema.safeParse(value).success).toBe(false);
    expect(criteriaSchema.safeParse(toCriteria(value)).success).toBe(false);
  });
  it('acepta fiador y póliza juntos y no inventa aceptación por parte del anuncio', () => {
    const value = { ...valid, hasPets: true, petCount: 2, petType: ' Perros y gato ', hasGuarantor: true, hasLegalPolicy: true };
    const front = schema.parse(value);
    const back = criteriaSchema.parse(toCriteria(value));
    for (const field of ['hasPets', 'petCount', 'petType', 'hasGuarantor', 'hasLegalPolicy'] as const) expect(front[field]).toEqual(back[field]);
    expect(back.petType).toBe('Perros y gato');
    expect(back).not.toHaveProperty('guarantee');
  });
  it('ignora los datos ocultos inválidos al comprar o desmarcar mascotas', () => {
    const stale = { ...valid, petCount: -4, petType: 'p'.repeat(121), hasGuarantor: true, hasLegalPolicy: true };
    expect(schema.safeParse({ ...stale, transactionType: 'buy', hasPets: true }).success).toBe(true);
    expect(schema.safeParse(stale).success).toBe(true);
  });
  it('envía la selección doble y limpia compra sin ejecutar una búsqueda real', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ searchId: 'local-test' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const rental = { ...valid, hasPets: true, petCount: 2, petType: 'Perros', hasGuarantor: true, hasLegalPolicy: true };
    await submitSearch(rental, 'key-rent');
    const rentBody = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(rentBody).toMatchObject({ hasPets: true, petCount: 2, petType: 'Perros', hasGuarantor: true, hasLegalPolicy: true });
    expect(rentBody).not.toHaveProperty('guarantee');
    await submitSearch({ ...rental, transactionType: 'buy' }, 'key-buy');
    const buyBody = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(buyBody).toMatchObject({ hasPets: false, petType: '', hasGuarantor: false, hasLegalPolicy: false });
    expect(buyBody).not.toHaveProperty('petCount');
  });
});

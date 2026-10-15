import { describe, expect, it, vi } from 'vitest';
vi.mock('./config.js', () => ({ config: { nodeEnv: 'test', sessionSecret: 'unit-test-signing-key' } }));
import { readSearch, signSearch } from './searchSession.js';
import { snapshot } from './testFixtures.js';

describe('consulta firmada antes de pedir contacto', () => {
  it('conserva criterios y ligas del servidor sin datos de contacto', () => {
    const original = snapshot();
    const parsed = readSearch(signSearch(original), original.searchId);
    expect(parsed?.matches[0].sourceUrl).toBe(original.matches[0].sourceUrl);
    expect(parsed?.criteria).not.toHaveProperty('email');
  });
  it('rechaza datos modificados, otro folio y consultas vencidas', () => {
    const original = snapshot(), token = signSearch(original);
    expect(readSearch('x' + token, original.searchId)).toBeNull();
    expect(readSearch(token, 'another-search')).toBeNull();
    expect(readSearch(token, original.searchId, Date.now() + 3 * 60 * 60 * 1000)).toBeNull();
  });
  it('conserva el protocolo petType y petCount de consultas firmadas en producción', () => {
    const original = snapshot();
    original.criteria = { ...original.criteria, transactionType: 'rent', hasPets: true, petCount: 2, petType: 'Perro y gato', hasGuarantor: true, hasLegalPolicy: true };
    expect(readSearch(signSearch(original), original.searchId)?.criteria).toEqual(original.criteria);
  });
  it('normaliza la garantía antigua sin inventar una selección adicional', () => {
    const original = snapshot();
    original.criteria = { ...original.criteria, transactionType: 'rent', hasGuarantor: undefined, hasLegalPolicy: undefined, guarantee: 'legal_policy' } as unknown as typeof original.criteria;
    const parsed = readSearch(signSearch(original), original.searchId);
    expect(parsed?.criteria).toMatchObject({ hasGuarantor: false, hasLegalPolicy: true });
    expect(parsed?.criteria).not.toHaveProperty('guarantee');
  });
  it('conserva la deselección explícita al leer una consulta con garantía antigua', () => {
    const original = snapshot();
    original.criteria = { ...original.criteria, transactionType: 'rent', hasGuarantor: false, hasLegalPolicy: true, guarantee: 'guarantor' } as unknown as typeof original.criteria;
    const parsed = readSearch(signSearch(original), original.searchId);
    expect(parsed?.criteria).toMatchObject({ hasGuarantor: false, hasLegalPolicy: true });
    expect(parsed?.criteria).not.toHaveProperty('guarantee');
  });
  it('requiere refrescar una consulta antigua sin cantidad o tipo separados', () => {
    const original = snapshot();
    original.criteria = { ...original.criteria, transactionType: 'rent', hasPets: true, petDetails: '2 perros medianos', petCount: undefined, petType: undefined } as unknown as typeof original.criteria;
    expect(readSearch(signSearch(original), original.searchId)).toBeNull();
  });
  it('limpia controles de renta de una consulta de compra antigua', () => {
    const original = snapshot();
    original.criteria = { ...original.criteria, hasPets: true, petCount: 2, petType: 'Gatos', hasGuarantor: true, hasLegalPolicy: true };
    expect(readSearch(signSearch(original), original.searchId)?.criteria).toMatchObject({ hasPets: false, petCount: 0, petType: '', hasGuarantor: false, hasLegalPolicy: false });
  });
});

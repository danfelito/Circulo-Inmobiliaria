import { describe, expect, it } from 'vitest';
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
});

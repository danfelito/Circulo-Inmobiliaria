import { afterEach, describe, expect, it, vi } from 'vitest';
import { criteria } from './testFixtures.js';
vi.mock('./repository.js', () => ({
  getProperties: vi.fn(async () => []),
  getProviders: vi.fn(async () => [{ id: 'source-1', name: 'Círculo', baseUrl: 'https://circulointernacionalveracruz.org/propiedades', enabled: true }]),
}));
import { allowedUrl, collectProviderInventory, portalProperty } from './providers.js';
const row = { id: 'p1', title: 'Casa real', slug: 'casa-real', type: 'casa', operation: 'venta', currency: 'MXN', price: 2_000_000, city: 'Boca del Río', address: 'Colonia Costa de Oro', status: 'available', published: true, bedrooms: 3, bathrooms: null, parking: 1, lotArea: 200, area: 150, features: '["Alberca", "Sin jardín"]', photos: [] };
afterEach(() => vi.unstubAllGlobals());
describe('fuentes y datos publicados', () => {
  it('conserva desconocidos y no infiere jardín de una negación', () => {
    const result = portalProperty(row, new Date().toISOString());
    expect(result?.pool).toBe(true);
    expect(result?.garden).toBe(false);
    expect(result?.verifiedFields).not.toContain('garden');
    expect(result?.verifiedFields).not.toContain('bathrooms');
  });
  it('omite inmuebles vendidos, ocultos y con otra moneda', () => {
    expect(portalProperty({ ...row, status: 'sold' }, '')).toBeNull();
    expect(portalProperty({ ...row, published: false }, '')).toBeNull();
    expect(portalProperty({ ...row, currency: 'USD' }, '')).toBeNull();
  });
  it('no acepta dominios parecidos ni protocolos ejecutables', () => {
    expect(allowedUrl('https://notexample.com/casa', ['example.com'])).toBe(false);
    expect(allowedUrl('javascript:alert(1)', ['example.com'])).toBe(false);
    expect(allowedUrl('https://www.example.com/casa', ['example.com'])).toBe(true);
  });
  it('consulta el catálogo público paginado sin filtrar las alternativas por presupuesto', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ properties: [row], pagination: { pages: 1 } }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const result = await collectProviderInventory(criteria);
    expect(result.sourcesConsulted).toBe(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get('operation')).toBe('venta');
    expect(url.searchParams.has('maxPrice')).toBe(false);
    expect(result.properties[0].sourceUrl).toBe('https://circulointernacionalveracruz.org/propiedades/casa-real');
  });
  it('un fallo de fuente se reporta como cobertura parcial', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const result = await collectProviderInventory(criteria);
    expect(result.sourcesConsulted).toBe(0);
    expect(result.warnings.join(' ')).toContain('fallo');
  });
});

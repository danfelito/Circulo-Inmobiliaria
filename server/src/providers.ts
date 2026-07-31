import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { config } from './config.js';
import { getProperties, getProviders } from './repository.js';
import type { LeadInput, Property, ProviderInput } from './schemas.js';

const webListingSchema = z.object({
  listings: z.array(z.object({
    title: z.string().min(3).max(220),
    url: z.string().url(),
    price: z.number().positive(),
    transactionType: z.enum(['rent', 'buy']),
    propertyType: z.enum(['house', 'apartment', 'land', 'retail', 'office', 'warehouse', 'ranch']),
    city: z.string().min(2).max(120),
    neighborhood: z.string().max(120).default(''),
    bedrooms: z.number().min(0).max(30).default(0),
    bathrooms: z.number().min(0).max(30).default(0),
    parking: z.number().min(0).max(20).default(0),
    landArea: z.number().min(0).default(0),
    constructionArea: z.number().min(0).default(0),
    yard: z.boolean().default(false),
    garden: z.boolean().default(false),
    pool: z.boolean().default(false),
    amenities: z.array(z.string().max(80)).max(15).default([]),
  })).max(24),
});

export type ProviderCheck = {
  id: string;
  name: string;
  url: string;
  host: string;
  enabled: boolean;
  reachable: boolean;
  readable: boolean;
  statusCode?: number;
  contentType?: string;
  charactersRead?: number;
  message: string;
};

function hostFromUrl(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function sourceName(url: string, providers: ProviderInput[]) {
  const host = hostFromUrl(url);
  return providers.find((provider) => host.endsWith(hostFromUrl(provider.baseUrl)))?.name || host || 'Fuente configurada';
}

function propertyId(url: string) {
  return `web-${createHash('sha256').update(url).digest('hex').slice(0, 24)}`;
}

async function searchConfiguredSources(lead: LeadInput, providers: ProviderInput[]): Promise<Property[]> {
  if (!config.openaiApiKey) return [];
  const domains = [...new Set(providers.map((provider) => hostFromUrl(provider.baseUrl)).filter(Boolean))];
  if (!domains.length) return [];

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const criteria = {
    operation: lead.transactionType === 'rent' ? 'renta' : 'venta',
    propertyType: lead.propertyType,
    city: lead.city,
    neighborhoods: lead.neighborhoods,
    budgetMin: lead.budgetMin,
    budgetMax: lead.budgetMax,
    bedrooms: lead.bedrooms,
    bathrooms: lead.bathrooms,
    parking: lead.parking,
    pool: lead.pool,
    garden: lead.garden,
    yard: lead.yard,
    landAreaMin: lead.landAreaMin,
    constructionAreaMin: lead.constructionAreaMin,
    essentialFeatures: lead.essentialFeatures,
  };

  try {
    const response = await client.responses.parse({
      model: config.openaiModel,
      store: false,
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search', search_context_size: 'low', filters: { allowed_domains: domains } }],
      tool_choice: 'required',
      input: [
        {
          role: 'system',
          content: 'Busca anuncios inmobiliarios reales y vigentes únicamente en los dominios permitidos. Devuelve solo páginas directas de propiedades que razonablemente correspondan a los criterios. No devuelvas portadas, páginas de categoría, búsquedas generales ni enlaces sin una propiedad identificable. No inventes precio, ubicación, características o URL. Omite cualquier anuncio cuyos datos esenciales no puedan verificarse en la página consultada.',
        },
        { role: 'user', content: `Criterios de búsqueda: ${JSON.stringify(criteria)}. Prioriza coincidencias dentro del presupuesto y devuelve hasta 24 anuncios.` },
      ],
      text: { format: zodTextFormat(webListingSchema, 'property_web_search_results') },
    });

    const parsed = response.output_parsed;
    if (!parsed) return [];
    return parsed.listings.map((listing) => ({
      id: propertyId(listing.url),
      title: listing.title,
      transactionType: listing.transactionType,
      propertyType: listing.propertyType,
      city: listing.city,
      neighborhood: listing.neighborhood,
      price: listing.price,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      parking: listing.parking,
      landArea: listing.landArea,
      constructionArea: listing.constructionArea,
      floors: 0,
      yard: listing.yard,
      garden: listing.garden,
      pool: listing.pool,
      amenities: listing.amenities,
      sourceName: sourceName(listing.url, providers),
      sourceUrl: listing.url,
      verifiedAt: new Date().toISOString(),
      demo: false,
    }));
  } catch (error) {
    console.error('Configured source search failed.', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

async function checkProvider(provider: ProviderInput): Promise<ProviderCheck> {
  const host = hostFromUrl(provider.baseUrl);
  if (!provider.enabled || !provider.baseUrl) {
    return { id: provider.id, name: provider.name, url: provider.baseUrl, host, enabled: provider.enabled, reachable: false, readable: false, message: 'Fuente inactiva o sin liga.' };
  }
  if (!host) {
    return { id: provider.id, name: provider.name, url: provider.baseUrl, host: '', enabled: true, reachable: false, readable: false, message: 'La liga no tiene un dominio válido.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(provider.baseUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CirculoInmobiliarioSourceCheck/1.0)',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    const charactersRead = text.trim().length;
    const readable = response.ok && charactersRead >= 120 && /(text\/html|application\/json|text\/plain)/i.test(contentType);
    return {
      id: provider.id,
      name: provider.name,
      url: provider.baseUrl,
      host,
      enabled: true,
      reachable: response.ok,
      readable,
      statusCode: response.status,
      contentType,
      charactersRead,
      message: readable
        ? 'La liga respondió y su contenido puede leerse desde el servidor.'
        : response.ok
          ? 'La liga respondió, pero no entregó contenido suficiente o compatible para lectura.'
          : `La liga respondió con estado HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      id: provider.id,
      name: provider.name,
      url: provider.baseUrl,
      host,
      enabled: true,
      reachable: false,
      readable: false,
      message: error instanceof Error && error.name === 'AbortError' ? 'La liga excedió 10 segundos de espera.' : `No fue posible abrir la liga: ${error instanceof Error ? error.message : 'error desconocido'}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkProviderSources() {
  const providers = await getProviders();
  const results = await Promise.all(providers.map(checkProvider));
  return {
    checkedAt: new Date().toISOString(),
    openaiConfigured: Boolean(config.openaiApiKey),
    model: config.openaiModel,
    active: results.filter((item) => item.enabled).length,
    readable: results.filter((item) => item.readable).length,
    results,
  };
}

export async function collectProviderInventory(lead: LeadInput) {
  const providers = (await getProviders()).filter((provider) => provider.enabled && provider.baseUrl);
  const [catalog, webListings] = await Promise.all([getProperties(), searchConfiguredSources(lead, providers)]);
  const realCatalog = catalog.filter((property) => !property.demo && property.sourceUrl && property.sourceUrl !== '#');
  const deduped = new Map<string, Property>();
  for (const property of [...realCatalog, ...webListings]) deduped.set(property.id, property);
  return { properties: [...deduped.values()], sourcesConsulted: providers.length };
}

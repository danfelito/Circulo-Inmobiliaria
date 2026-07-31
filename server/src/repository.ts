import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { demoProperties, demoProviders } from './demoData.js';
import { providersSchema, type AiAnalysis, type LeadInput, type MatchResult, type Property, type ProviderInput } from './schemas.js';

export type StoredLead = { id: string; idempotencyKey: string; responsePayload?: unknown; duplicate: boolean };
type MemoryLead = StoredLead & { payload: LeadInput };
export type LeadConfirmationData = {
  lead: LeadInput;
  analysis: AiAnalysis;
  matches: MatchResult[];
  confirmationSent: boolean;
  selectedPropertyIds: string[];
};

const memoryLeads = new Map<string, MemoryLead>();
let memoryProperties: Property[] = [...demoProperties];
let memoryProviders: ProviderInput[] = [...demoProviders];
const requiredProviderUrl = 'https://circulointernacional.com/home-page/properties/home';

function getClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ensureRequiredProvider(providers: ProviderInput[]): ProviderInput[] {
  if (providers.some((provider) => provider.baseUrl.includes('circulointernacional.com'))) return providers;
  const copy = providers.slice(0, 10);
  while (copy.length < 10) copy.push({ id: `source-${copy.length + 1}`, name: `Fuente ${copy.length + 1}`, baseUrl: '', enabled: false });
  const target = copy.findIndex((provider) => !provider.baseUrl || !provider.enabled);
  const index = target >= 0 ? target : 0;
  copy[index] = { ...copy[index], name: 'Círculo Internacional', baseUrl: requiredProviderUrl, enabled: true };
  return providersSchema.parse(copy);
}

function saveLeadInMemory(lead: LeadInput, idempotencyKey: string): StoredLead {
  const existing = memoryLeads.get(idempotencyKey);
  if (existing) return { ...existing, duplicate: true };
  const record: MemoryLead = { id: randomUUID(), idempotencyKey, payload: lead, duplicate: false };
  memoryLeads.set(idempotencyKey, record);
  return record;
}

export async function saveLead(lead: LeadInput, idempotencyKey: string): Promise<StoredLead> {
  const cached = memoryLeads.get(idempotencyKey);
  if (cached) return { ...cached, duplicate: true };

  const supabase = getClient();
  if (!supabase) return saveLeadInMemory(lead, idempotencyKey);

  const existing = await supabase.from('leads').select('id,idempotency_key,response_payload').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing.error) {
    console.warn('Supabase lead lookup failed; in-memory fallback used.', existing.error.message);
    return saveLeadInMemory(lead, idempotencyKey);
  }
  if (existing.data) return { id: existing.data.id, idempotencyKey: existing.data.idempotency_key, responsePayload: existing.data.response_payload, duplicate: true };

  const inserted = await supabase.from('leads').insert({
    idempotency_key: idempotencyKey,
    transaction_type: lead.transactionType,
    full_name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    budget_min: lead.budgetMin,
    budget_max: lead.budgetMax,
    status: 'new',
    payload: lead,
    consent_at: new Date().toISOString(),
  }).select('id,idempotency_key').single();

  if (inserted.error) {
    console.warn('Supabase lead insert failed; in-memory fallback used.', inserted.error.message);
    return saveLeadInMemory(lead, idempotencyKey);
  }

  const record: MemoryLead = { id: inserted.data.id, idempotencyKey: inserted.data.idempotency_key, payload: lead, duplicate: false };
  memoryLeads.set(idempotencyKey, record);
  return record;
}

export async function updateLeadResult(leadId: string, responsePayload: unknown, hasMatches: boolean) {
  for (const [key, record] of memoryLeads.entries()) {
    if (record.id === leadId) memoryLeads.set(key, { ...record, responsePayload });
  }

  const supabase = getClient();
  if (!supabase) return;
  const result = await supabase.from('leads').update({ response_payload: responsePayload, status: hasMatches ? 'with_matches' : 'without_matches', analyzed_at: new Date().toISOString() }).eq('id', leadId);
  if (result.error) console.warn('Lead result could not be persisted.', result.error.message);
}

function parseConfirmationData(lead: LeadInput, responsePayload: unknown): LeadConfirmationData | null {
  if (!responsePayload || typeof responsePayload !== 'object') return null;
  const payload = responsePayload as {
    analysis?: AiAnalysis;
    matches?: MatchResult[];
    confirmationSent?: boolean;
    selectedPropertyIds?: string[];
  };
  if (!payload.analysis || !Array.isArray(payload.matches)) return null;
  return {
    lead,
    analysis: payload.analysis,
    matches: payload.matches,
    confirmationSent: Boolean(payload.confirmationSent),
    selectedPropertyIds: Array.isArray(payload.selectedPropertyIds) ? payload.selectedPropertyIds : [],
  };
}

export async function getLeadForConfirmation(leadId: string): Promise<LeadConfirmationData | null> {
  for (const record of memoryLeads.values()) {
    if (record.id === leadId) return parseConfirmationData(record.payload, record.responsePayload);
  }

  const supabase = getClient();
  if (!supabase) return null;
  const result = await supabase.from('leads').select('id,idempotency_key,payload,response_payload').eq('id', leadId).maybeSingle();
  if (result.error) {
    console.warn('Lead confirmation lookup failed.', result.error.message);
    return null;
  }
  if (!result.data?.payload) return null;

  const lead = result.data.payload as LeadInput;
  const record: MemoryLead = {
    id: result.data.id,
    idempotencyKey: result.data.idempotency_key || `db-${result.data.id}`,
    payload: lead,
    responsePayload: result.data.response_payload,
    duplicate: false,
  };
  memoryLeads.set(record.idempotencyKey, record);
  return parseConfirmationData(lead, result.data.response_payload);
}

export async function markLeadConfirmed(leadId: string, selectedPropertyIds: string[], emailSent: boolean) {
  let updatedPayload: Record<string, unknown> | null = null;
  for (const [key, record] of memoryLeads.entries()) {
    if (record.id !== leadId) continue;
    const current = record.responsePayload && typeof record.responsePayload === 'object' ? record.responsePayload as Record<string, unknown> : {};
    updatedPayload = {
      ...current,
      confirmationSent: emailSent,
      confirmationAttemptedAt: new Date().toISOString(),
      selectedPropertyIds,
    };
    memoryLeads.set(key, { ...record, responsePayload: updatedPayload });
  }

  const supabase = getClient();
  if (!supabase) return;
  if (!updatedPayload) {
    const existing = await supabase.from('leads').select('response_payload').eq('id', leadId).maybeSingle();
    if (existing.data?.response_payload && typeof existing.data.response_payload === 'object') {
      updatedPayload = {
        ...(existing.data.response_payload as Record<string, unknown>),
        confirmationSent: emailSent,
        confirmationAttemptedAt: new Date().toISOString(),
        selectedPropertyIds,
      };
    }
  }
  const result = await supabase.from('leads').update({ status: emailSent ? 'confirmed' : 'confirmation_pending_email', response_payload: updatedPayload }).eq('id', leadId);
  if (result.error) console.warn('Lead confirmation status could not be persisted.', result.error.message);
}

export async function saveSearch(leadId: string, criteria: LeadInput, analysis: unknown, matches: MatchResult[]) {
  const supabase = getClient();
  if (!supabase) return;
  const result = await supabase.from('searches').insert({ lead_id: leadId, criteria, analysis, result_count: matches.length }).select('id').single();
  if (result.error) throw result.error;
  if (!matches.length) return;
  const rows = matches.map((match) => ({ search_id: result.data.id, property_id: match.demo ? null : match.id, match_score: match.matchScore, reasons: match.reasons, gaps: match.gaps, snapshot: match }));
  const saved = await supabase.from('search_results').insert(rows);
  if (saved.error) throw saved.error;
}

export async function getProperties(): Promise<Property[]> {
  const supabase = getClient();
  if (!supabase) return memoryProperties;
  const result = await supabase.from('properties').select('*').eq('active', true).limit(1000);
  if (result.error) { console.warn('Properties table unavailable; demo catalog used.', result.error.message); return memoryProperties; }
  if (!result.data?.length) return demoProperties;
  return result.data.map((row) => ({
    id: row.id,
    title: row.title,
    transactionType: row.transaction_type,
    propertyType: row.property_type,
    city: row.city,
    neighborhood: row.neighborhood,
    price: Number(row.price),
    bedrooms: Number(row.bedrooms ?? 0),
    bathrooms: Number(row.bathrooms ?? 0),
    parking: Number(row.parking ?? 0),
    landArea: Number(row.land_area ?? 0),
    constructionArea: Number(row.construction_area ?? 0),
    floors: Number(row.floors ?? 0),
    furnished: row.furnished ?? undefined,
    yard: Boolean(row.yard),
    garden: Boolean(row.garden),
    pool: Boolean(row.pool),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    sourceName: row.source_name,
    sourceUrl: row.source_url || '#',
    verifiedAt: row.verified_at ?? undefined,
    demo: Boolean(row.demo),
  }));
}

export async function getProviders(): Promise<ProviderInput[]> {
  const supabase = getClient();
  if (!supabase) { memoryProviders = ensureRequiredProvider(memoryProviders); return memoryProviders; }
  const result = await supabase.from('providers').select('*').like('id', 'source-%').order('position');
  if (result.error) {
    console.warn('Providers table unavailable; in-memory sources used.', result.error.message);
    memoryProviders = ensureRequiredProvider(memoryProviders);
    return memoryProviders;
  }
  if (!result.data?.length) return ensureRequiredProvider(demoProviders);
  return ensureRequiredProvider(providersSchema.parse(result.data.map((row) => ({ id: row.id, name: row.name, baseUrl: row.base_url ?? '', enabled: Boolean(row.enabled) }))));
}

export async function saveProviders(input: unknown): Promise<ProviderInput[]> {
  const providers = ensureRequiredProvider(providersSchema.parse(input));
  const supabase = getClient();
  memoryProviders = providers;
  if (!supabase) return memoryProviders;
  const rows = providers.map((provider, index) => ({ id: provider.id, position: index + 1, name: provider.name, base_url: provider.baseUrl, integration_type: 'search_link', enabled: provider.enabled, updated_at: new Date().toISOString() }));
  const result = await supabase.from('providers').upsert(rows).select('*').order('position');
  if (result.error) {
    console.warn('Providers could not be persisted; in-memory copy retained.', result.error.message);
    return memoryProviders;
  }
  return providers;
}

function coerceProperty(row: Record<string, unknown>, index: number): Property {
  const string = (key: string, fallback = '') => String(row[key] ?? fallback).trim();
  const number = (key: string) => Number(row[key] ?? 0);
  const bool = (key: string) => ['true', '1', 'yes', 'si', 'sí'].includes(string(key).toLowerCase()) || row[key] === true;
  const amenitiesValue = row.amenities;
  const amenities = Array.isArray(amenitiesValue) ? amenitiesValue.map(String) : string('amenities').split(/[|,;]/).map((item) => item.trim()).filter(Boolean);
  const propertyTypeValue = string('propertyType', string('property_type'));
  const acceptedTypes: Property['propertyType'][] = ['house', 'apartment', 'land', 'retail', 'office', 'warehouse', 'ranch'];
  return {
    id: string('id', `import-${Date.now()}-${index}`),
    title: string('title', 'Propiedad importada'),
    transactionType: string('transactionType', string('transaction_type')) === 'rent' ? 'rent' : 'buy',
    propertyType: acceptedTypes.includes(propertyTypeValue as Property['propertyType']) ? propertyTypeValue as Property['propertyType'] : 'house',
    city: string('city'),
    neighborhood: string('neighborhood'),
    price: number('price'),
    bedrooms: number('bedrooms'),
    bathrooms: number('bathrooms'),
    parking: number('parking'),
    landArea: number('landArea') || number('land_area'),
    constructionArea: number('constructionArea') || number('construction_area'),
    floors: number('floors'),
    furnished: undefined,
    yard: bool('yard'),
    garden: bool('garden'),
    pool: bool('pool'),
    amenities,
    sourceName: string('sourceName', string('source_name', 'Importación')),
    sourceUrl: string('sourceUrl', string('source_url', '#')),
    verifiedAt: string('verifiedAt', string('verified_at')) || undefined,
    demo: bool('demo'),
  };
}

export async function importProperties(content: string, format: 'csv' | 'json') {
  const raw = format === 'json' ? JSON.parse(content) : parse(content, { columns: true, skip_empty_lines: true, trim: true });
  if (!Array.isArray(raw)) throw new Error('El archivo debe contener una lista de propiedades.');
  const properties = raw.map((row, index) => coerceProperty(row as Record<string, unknown>, index));
  const supabase = getClient();
  if (!supabase) { memoryProperties = [...properties, ...memoryProperties]; return properties.length; }
  const rows = properties.map((property) => ({
    id: property.id,
    title: property.title,
    transaction_type: property.transactionType,
    property_type: property.propertyType,
    city: property.city,
    neighborhood: property.neighborhood,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    land_area: property.landArea,
    construction_area: property.constructionArea,
    floors: property.floors,
    furnished: property.furnished ?? null,
    yard: property.yard,
    garden: property.garden,
    pool: property.pool,
    amenities: property.amenities,
    source_name: property.sourceName,
    source_url: property.sourceUrl,
    verified_at: property.verifiedAt ?? null,
    demo: property.demo,
    active: true,
  }));
  const result = await supabase.from('properties').upsert(rows);
  if (result.error) throw result.error;
  return properties.length;
}

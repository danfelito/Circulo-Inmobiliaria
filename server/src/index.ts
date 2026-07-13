import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

const app = express();
const port = Number(process.env.PORT || 10000);
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
const resendApiKey = process.env.RESEND_API_KEY?.trim();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const db = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const ai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const mail = resendApiKey ? new Resend(resendApiKey) : null;
const cache = new Map<string, SearchResponse>();

const leadSchema = z.object({
  transactionType: z.enum(['rent', 'buy']),
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(8).max(40),
  propertyType: z.enum(['house', 'apartment', 'land']),
  city: z.string().trim().min(2).max(120),
  neighborhoods: z.array(z.string().trim().max(120)).max(3).default([]),
  budgetMin: z.coerce.number().min(0),
  budgetMax: z.coerce.number().positive(),
  bedrooms: z.coerce.number().min(0).max(20).default(0),
  bathrooms: z.coerce.number().min(0).max(20).default(0),
  parking: z.coerce.number().int().min(0).max(20).default(0),
  yard: z.boolean().default(false),
  garden: z.boolean().default(false),
  pool: z.boolean().default(false),
  landAreaMin: z.coerce.number().min(0).default(0),
  constructionAreaMin: z.coerce.number().min(0).default(0),
  privacyAccepted: z.literal(true),
  contactAccepted: z.literal(true),
  essentialFeatures: z.array(z.string().trim().max(150)).max(30).default([]),
  desirableFeatures: z.array(z.string().trim().max(150)).max(30).default([]),
  website: z.string().max(0).default(''),
}).passthrough().refine((value) => value.budgetMax >= value.budgetMin, {
  message: 'El presupuesto máximo debe ser mayor o igual al mínimo.',
  path: ['budgetMax'],
});

type Lead = z.infer<typeof leadSchema>;
type Property = {
  id: string;
  title: string;
  transactionType: 'rent' | 'buy';
  propertyType: 'house' | 'apartment' | 'land';
  city: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  landArea: number;
  constructionArea: number;
  yard: boolean;
  garden: boolean;
  pool: boolean;
  amenities: string[];
  sourceName: string;
  sourceUrl: string;
  demo: boolean;
};
type Match = Property & {
  matchScore: number;
  reasons: string[];
  gaps: string[];
  availabilityLabel: string;
};
type Analysis = {
  viability: 'high' | 'medium' | 'low' | 'insufficient_data';
  headline: string;
  explanation: string;
  pressurePoints: string[];
  suggestions: string[];
  advisorSummary: string;
};
type SearchResponse = {
  leadId: string;
  duplicate: boolean;
  analysisSource: 'openai' | 'deterministic';
  metrics: { completeness: number; rigidity: string; contradictions: string[] };
  analysis: Analysis;
  matches: Match[];
  externalSearchLinks: { name: string; url: string }[];
  message: string;
  disclaimer: string;
};

const demoProperties: Property[] = [
  { id: 'r1', title: 'Casa familiar con estudio', transactionType: 'rent', propertyType: 'house', city: 'Boca del Río', neighborhood: 'Virginia', price: 24000, bedrooms: 3, bathrooms: 2.5, parking: 2, landArea: 180, constructionArea: 210, yard: true, garden: false, pool: false, amenities: ['estudio', 'seguridad'], sourceName: 'Catálogo demo', sourceUrl: '#', demo: true },
  { id: 'b1', title: 'Departamento con amenidades', transactionType: 'buy', propertyType: 'apartment', city: 'Boca del Río', neighborhood: 'Costa de Oro', price: 3200000, bedrooms: 3, bathrooms: 2, parking: 2, landArea: 0, constructionArea: 145, yard: false, garden: false, pool: true, amenities: ['elevador', 'seguridad'], sourceName: 'Catálogo demo', sourceUrl: '#', demo: true },
  { id: 'b2', title: 'Casa con jardín', transactionType: 'buy', propertyType: 'house', city: 'Veracruz', neighborhood: 'Reforma', price: 2800000, bedrooms: 3, bathrooms: 2.5, parking: 2, landArea: 220, constructionArea: 190, yard: true, garden: true, pool: false, amenities: ['estudio'], sourceName: 'Catálogo demo', sourceUrl: '#', demo: true },
];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function rankProperty(property: Property, lead: Lead): Match | null {
  if (property.transactionType !== lead.transactionType) return null;
  let score = 100;
  const reasons: string[] = [];
  const gaps: string[] = [];

  if (property.propertyType !== lead.propertyType) { score -= 25; gaps.push('Tipología distinta'); }
  else reasons.push('Tipología solicitada');

  if (normalize(property.city) !== normalize(lead.city)) { score -= 35; gaps.push('Ciudad distinta'); }
  else reasons.push('Ciudad solicitada');

  if (lead.neighborhoods.length && !lead.neighborhoods.some((item) => normalize(item) === normalize(property.neighborhood))) {
    score -= 15;
    gaps.push('Colonia distinta');
  }

  if (property.price > lead.budgetMax) {
    const over = (property.price - lead.budgetMax) / lead.budgetMax;
    score -= Math.min(55, Math.round(over * 100));
    gaps.push(`Supera el presupuesto en ${Math.round(over * 100)}%`);
  } else reasons.push('Dentro del presupuesto');

  if (property.bedrooms < lead.bedrooms) { score -= 20; gaps.push('Menos recámaras'); }
  else reasons.push('Recámaras suficientes');
  if (property.bathrooms < lead.bathrooms) { score -= 10; gaps.push('Menos baños'); }
  if (property.parking < lead.parking) { score -= 8; gaps.push('Menos estacionamientos'); }
  if (lead.pool && !property.pool) { score -= 15; gaps.push('Sin alberca'); }
  if (lead.garden && !property.garden) { score -= 10; gaps.push('Sin jardín'); }
  if (lead.yard && !property.yard) { score -= 8; gaps.push('Sin patio'); }
  if (lead.landAreaMin && property.landArea < lead.landAreaMin) { score -= 12; gaps.push('Menor superficie de terreno'); }
  if (lead.constructionAreaMin && property.constructionArea < lead.constructionAreaMin) { score -= 12; gaps.push('Menor superficie de construcción'); }

  return {
    ...property,
    matchScore: Math.max(0, score),
    reasons,
    gaps,
    availabilityLabel: property.demo ? 'Propiedad ficticia para demostración' : 'Disponibilidad por confirmar',
  };
}

function deterministicAnalysis(lead: Lead, matches: Match[]): Analysis {
  const difficult = lead.bedrooms >= 4 || lead.pool || lead.neighborhoods.length >= 2;
  return {
    viability: matches.length ? 'high' : difficult ? 'low' : 'medium',
    headline: matches.length ? 'Encontramos opciones compatibles' : 'La combinación actual necesita ajustes',
    explanation: matches.length
      ? 'Existen propiedades con compatibilidad razonable. El asesor confirmará disponibilidad y condiciones.'
      : 'No aparece una coincidencia suficiente en las fuentes configuradas. Esto no significa que no exista en todo el mercado; conviene flexibilizar uno o dos criterios.',
    pressurePoints: matches.length ? [] : ['El presupuesto, la ubicación y las características no coinciden simultáneamente con el inventario consultado.'],
    suggestions: [
      'Ampliar las colonias o zonas aceptadas',
      'Aumentar el presupuesto máximo alrededor de 15%',
      'Reducir una recámara cuando no sea indispensable',
      'Considerar otra tipología de inmueble',
    ],
    advisorSummary: `Busca ${lead.transactionType === 'rent' ? 'renta' : 'compra'} de ${lead.propertyType} en ${lead.city}, con presupuesto máximo de ${lead.budgetMax} MXN.`,
  };
}

function isAnalysis(value: unknown): value is Analysis {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.headline === 'string' && typeof item.explanation === 'string' && Array.isArray(item.suggestions) && typeof item.advisorSummary === 'string';
}

async function explainWithAi(lead: Lead, base: Analysis): Promise<{ analysis: Analysis; source: 'openai' | 'deterministic' }> {
  if (!ai) return { analysis: base, source: 'deterministic' };
  try {
    const response = await ai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      store: false,
      reasoning: { effort: 'low' },
      input: [
        { role: 'system', content: 'Redacta un diagnóstico inmobiliario prudente en JSON. No inventes inventario, precios ni disponibilidad. Devuelve las claves viability, headline, explanation, pressurePoints, suggestions y advisorSummary.' },
        { role: 'user', content: JSON.stringify({ transactionType: lead.transactionType, propertyType: lead.propertyType, city: lead.city, neighborhoods: lead.neighborhoods, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, bedrooms: lead.bedrooms, bathrooms: lead.bathrooms, pool: lead.pool, garden: lead.garden, yard: lead.yard, base }) },
      ],
    });
    const parsed: unknown = JSON.parse(response.output_text);
    return isAnalysis(parsed) ? { analysis: parsed, source: 'openai' } : { analysis: base, source: 'deterministic' };
  } catch (error) {
    console.error('OpenAI analysis failed; deterministic fallback used.', error instanceof Error ? error.message : 'unknown');
    return { analysis: base, source: 'deterministic' };
  }
}

async function getInventory(): Promise<Property[]> {
  if (!db) return demoProperties;
  const { data, error } = await db.from('properties').select('*').eq('active', true).limit(500);
  if (error || !data) {
    console.error('Supabase inventory failed; demo catalog used.', error?.message || 'unknown');
    return demoProperties;
  }
  return data.map((property) => ({
    id: String(property.id), title: String(property.title), transactionType: property.transaction_type, propertyType: property.property_type,
    city: String(property.city), neighborhood: String(property.neighborhood || ''), price: Number(property.price), bedrooms: Number(property.bedrooms),
    bathrooms: Number(property.bathrooms), parking: Number(property.parking), landArea: Number(property.land_area), constructionArea: Number(property.construction_area),
    yard: Boolean(property.yard), garden: Boolean(property.garden), pool: Boolean(property.pool), amenities: Array.isArray(property.amenities) ? property.amenities.map(String) : [],
    sourceName: String(property.source_name), sourceUrl: String(property.source_url || ''), demo: Boolean(property.demo),
  }));
}

function externalLinks(lead: Lead) {
  const query = encodeURIComponent(`${lead.propertyType} ${lead.city} ${lead.neighborhoods.join(' ')} ${lead.bedrooms} recámaras ${lead.budgetMax} MXN`);
  return [
    { name: 'Inmuebles24', url: `https://www.google.com/search?q=site%3Ainmuebles24.com+${query}` },
    { name: 'Vivanuncios', url: `https://www.google.com/search?q=site%3Avivanuncios.com.mx+${query}` },
    { name: 'Facebook Marketplace', url: `https://www.facebook.com/marketplace/search/?query=${query}` },
  ];
}

async function findStoredResponse(idempotencyKey: string): Promise<SearchResponse | null> {
  const memory = cache.get(idempotencyKey);
  if (memory) return memory;
  if (!db) return null;
  const { data, error } = await db.from('leads').select('response_payload').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (error) return null;
  return data?.response_payload ? data.response_payload as SearchResponse : null;
}

async function persistResponse(idempotencyKey: string, lead: Lead, result: SearchResponse) {
  cache.set(idempotencyKey, result);
  if (!db) return;
  const { error } = await db.from('leads').upsert({
    id: result.leadId,
    idempotency_key: idempotencyKey,
    transaction_type: lead.transactionType,
    full_name: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    budget_min: lead.budgetMin,
    budget_max: lead.budgetMax,
    status: result.matches.length ? 'with_matches' : 'without_matches',
    payload: lead,
    response_payload: result,
    consent_at: new Date().toISOString(),
  }, { onConflict: 'idempotency_key' });
  if (error) console.error('Supabase lead persistence failed.', error.message);
}

async function sendAdvisorEmail(lead: Lead, result: SearchResponse) {
  if (!mail) return;
  const response = await mail.emails.send({
    from: process.env.EMAIL_FROM || 'Círculo Inmobiliario <onboarding@resend.dev>',
    to: process.env.ADVISOR_EMAIL || 'patyestr@hotmail.com',
    subject: `Nueva solicitud: ${lead.fullName}`,
    html: `<h1>Nueva solicitud inmobiliaria</h1><p>${lead.fullName} · ${lead.email} · ${lead.phone}</p><p>${result.analysis.advisorSummary}</p><p>${result.matches.length} coincidencias.</p>`,
  });
  if (response.error) throw new Error(response.error.message);
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'circulo-inmobiliario', mode: db ? 'supabase' : 'demo', timestamp: new Date().toISOString() });
});

app.get('/api/demo/properties', (_request, response) => response.json(demoProperties));

app.post('/api/leads', async (request, response, next) => {
  try {
    const idempotencyKey = String(request.header('Idempotency-Key') || '').slice(0, 128);
    if (!idempotencyKey) return response.status(400).json({ error: 'Falta Idempotency-Key' });
    const stored = await findStoredResponse(idempotencyKey);
    if (stored) return response.json({ ...stored, duplicate: true });

    const parsed = leadSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: 'Datos incompletos o incoherentes', issues: parsed.error.flatten() });
    const lead = parsed.data;
    const inventory = await getInventory();
    const matches = inventory
      .map((property) => rankProperty(property, lead))
      .filter((item): item is Match => Boolean(item))
      .filter((item) => item.matchScore >= 65 && item.price <= lead.budgetMax * 1.1)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);
    const analysisResult = await explainWithAi(lead, deterministicAnalysis(lead, matches));
    const result: SearchResponse = {
      leadId: randomUUID(),
      duplicate: false,
      analysisSource: analysisResult.source,
      metrics: { completeness: 90, rigidity: lead.pool || lead.neighborhoods.length >= 2 ? 'high' : 'medium', contradictions: [] },
      analysis: analysisResult.analysis,
      matches,
      externalSearchLinks: externalLinks(lead),
      message: 'Muchas gracias por aceptar nuestras políticas. En breve estaremos en contacto contigo.',
      disclaimer: 'Precios, disponibilidad y condiciones deben confirmarse con el anunciante o asesor.',
    };
    await persistResponse(idempotencyKey, lead, result);
    try { await sendAdvisorEmail(lead, result); }
    catch (emailError) { console.error('Advisor email failed.', emailError instanceof Error ? emailError.message : 'unknown'); }
    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, '../../client/dist');
app.use(express.static(publicDir));
app.get('/{*splat}', (request, response, next) => {
  if (request.path.startsWith('/api/')) return next();
  return response.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error('Request failed.', error instanceof Error ? error.message : 'unknown');
  response.status(500).json({ error: 'No fue posible completar la solicitud. Intenta nuevamente.' });
});

app.listen(port, () => console.log(`Servidor activo en ${port}`));

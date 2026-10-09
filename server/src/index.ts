import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { config, isProduction } from './config.js';
import { contactSchema, criteriaSchema, leadSchema, providersSchema, type SearchSnapshot } from './schemas.js';
import { signSearch, readSearch } from './searchSession.js';
import { deterministicAnalysis, rankProperties } from './scoring.js';
import {
  getLeadForConfirmation,
  getProviders,
  importProperties,
  markLeadConfirmed,
  saveLead,
  saveProviders,
  saveSearch,
  updateLeadResult,
} from './repository.js';
import { checkProviderSources, collectProviderInventory } from './providers.js';
import { getEmailConfigurationStatus, sendAdvisorEmail, sendTestEmail } from './email.js';
import { issueAdminToken, validateAdminCredentials, verifyAdminToken } from './adminAuth.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: isProduction ? config.clientOrigin.split(',').map((item) => item.trim()) : true, credentials: false }));
app.use(express.json({ limit: '3mb' }));

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const submitLimiter = rateLimit({ windowMs: 30 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api', publicLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'circulo-inmobiliario', version: 'guided-search-v2', timestamp: new Date().toISOString(), mode: config.supabaseUrl ? 'supabase' : 'memory', model: config.openaiModel });
});

app.get('/api/contact-status', async (_req, res, next) => {
  try { const status = await getEmailConfigurationStatus(); res.json({ available: status.configured }); } catch (error) { next(error); }
});

const searches = new Map<string, { expires: number; promise: Promise<SearchSnapshot> }>();
app.post('/api/searches', submitLimiter, async (req, res, next) => {
  try {
    const parsed = criteriaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Revisa tus criterios de búsqueda.', issues: parsed.error.flatten() });
    const key = String(req.header('Idempotency-Key') || randomUUID()).slice(0, 128) + ':' + createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
    for (const [id, entry] of searches) if (entry.expires < Date.now()) searches.delete(id);
    if (searches.size > 500) searches.delete(searches.keys().next().value!);
    let entry = searches.get(key);
    if (!entry) {
      const promise = (async (): Promise<SearchSnapshot> => {
        const inventory = await collectProviderInventory(parsed.data);
        const ranked = rankProperties(parsed.data, inventory.properties);
        return { searchId: randomUUID(), createdAt: new Date().toISOString(), criteria: parsed.data, analysis: deterministicAnalysis(parsed.data, ranked.matches, ranked.alternatives, ranked.adjustments), ...ranked, sourcesConsulted: inventory.sourcesConsulted, warnings: inventory.warnings };
      })();
      entry = { expires: Date.now() + 20 * 60 * 1000, promise };
      searches.set(key, entry);
      promise.catch(() => searches.delete(key));
    }
    const snapshot = await entry.promise;
    return res.json({ ...snapshot, contactToken: signSearch(snapshot), matchCount: snapshot.matches.length, alternativeCount: snapshot.alternatives.length });
  } catch (error) { next(error); }
});

type ContactResponse = { confirmed: boolean; emailSent: boolean; leadId: string; selectedPropertyIds: string[]; message: string; duplicate?: boolean };
const contactRequests = new Map<string, Promise<ContactResponse>>();
app.post('/api/searches/:searchId/contact', submitLimiter, async (req, res, next) => {
  try {
    const input = z.object({ contactToken: z.string().min(20).max(500_000), selectedPropertyIds: z.array(z.string().min(1).max(180)).max(20), contact: contactSchema }).safeParse(req.body);
    if (!input.success) return res.status(422).json({ error: 'Revisa tus datos y autoriza el contacto.', issues: input.error.flatten() });
    const searchId = String(req.params.searchId);
    const snapshot = readSearch(input.data.contactToken, searchId);
    if (!snapshot) return res.status(410).json({ error: 'Esta consulta venció o no es válida. Actualiza la búsqueda antes de pedir contacto.' });
    const candidates = [...snapshot.matches, ...snapshot.alternatives];
    const selectedIds = [...new Set(input.data.selectedPropertyIds)];
    if (selectedIds.some(id => !candidates.some(property => property.id === id))) return res.status(422).json({ error: 'Una propiedad seleccionada no pertenece a esta consulta.' });
    const selected = candidates.filter(property => selectedIds.includes(property.id));
    let pending = contactRequests.get(searchId);
    if (!pending) {
      pending = (async (): Promise<ContactResponse> => {
        const lead = leadSchema.parse({ ...snapshot.criteria, ...input.data.contact });
        const stored = await saveLead(lead, 'contact-' + searchId);
        const previous = await getLeadForConfirmation(stored.id);
        if (previous?.confirmationSent) return { confirmed: true, emailSent: true, duplicate: true, leadId: stored.id, selectedPropertyIds: previous.selectedPropertyIds, message: 'Tu solicitud ya fue enviada. Un asesor dará seguimiento.' };
        await updateLeadResult(stored.id, { ...snapshot, matches: candidates, confirmationSent: false, emailSent: false, selectedPropertyIds: selectedIds }, snapshot.matches.length > 0);
        try {
          await sendAdvisorEmail(stored.id, lead, snapshot, selected);
          await Promise.allSettled([markLeadConfirmed(stored.id, selectedIds, true), saveSearch(stored.id, lead, snapshot.analysis, candidates)]);
          return { confirmed: true, emailSent: true, leadId: stored.id, selectedPropertyIds: selectedIds, message: 'Tu solicitud fue enviada al equipo de Círculo. Un asesor te contactará para revisar las opciones y los siguientes pasos.' };
        } catch (error) {
          console.error('Advisor report failed.', error instanceof Error ? error.message : 'unknown');
          await markLeadConfirmed(stored.id, selectedIds, false);
          return { confirmed: false, emailSent: false, leadId: stored.id, selectedPropertyIds: selectedIds, message: 'No pudimos enviar el reporte al equipo en este momento. Tus datos siguen en el formulario; puedes volver a intentarlo.' };
        }
      })();
      contactRequests.set(searchId, pending);
      // Persistence and provider idempotency handle subsequent retries/restarts.
      pending.finally(() => contactRequests.delete(searchId)).catch(() => undefined);
    }
    const result = await pending;
    return res.status(result.emailSent ? 200 : 503).json(result);
  } catch (error) { next(error); }
});

// Older cached clients must refresh instead of creating unsolicited email reports.
app.post(['/api/leads', '/api/leads/:leadId/confirm'], (_req, res) => res.status(409).json({ error: 'El buscador se actualizó. Recarga la página para consultar opciones y solicitar contacto al final.' }));

app.post('/api/admin/login', adminLimiter, async (req, res) => {
  const input = z.object({ login: z.string().min(3).max(180), password: z.string().min(8).max(200) }).safeParse(req.body);
  if (!input.success || !(await validateAdminCredentials(input.data.login, input.data.password))) return res.status(401).json({ error: 'Credenciales inválidas.' });
  return res.json({ token: issueAdminToken(), expiresInHours: 8 });
});

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!verifyAdminToken(token)) return res.status(401).json({ error: 'Sesión administrativa inválida o vencida.' });
  next();
}

app.get('/api/admin/status', requireAdmin, async (_req, res) => {
  const providers = await getProviders();
  res.json({
    ok: true,
    login: config.adminLogin,
    model: config.openaiModel,
    openaiConfigured: Boolean(config.openaiApiKey),
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    email: await getEmailConfigurationStatus(),
    activeSources: providers.filter((provider) => provider.enabled && provider.baseUrl).length,
  });
});

app.post('/api/admin/test-email', requireAdmin, async (_req, res, next) => {
  try { res.json(await sendTestEmail()); } catch (error) { next(error); }
});

app.post('/api/admin/check-sources', requireAdmin, async (_req, res, next) => {
  try { res.json(await checkProviderSources()); } catch (error) { next(error); }
});

app.get('/api/admin/providers', requireAdmin, async (_req, res, next) => {
  try { res.json(await getProviders()); } catch (error) { next(error); }
});
app.put('/api/admin/providers', requireAdmin, async (req, res, next) => {
  try { const input = z.object({ providers: providersSchema }).parse(req.body); res.json(await saveProviders(input.providers)); }
  catch (error) { next(error); }
});
app.post('/api/admin/import', requireAdmin, async (req, res, next) => {
  try { const input = z.object({ content: z.string().min(2).max(2_000_000), format: z.enum(['csv', 'json']) }).parse(req.body); res.json({ imported: await importProperties(input.content, input.format) }); }
  catch (error) { next(error); }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, '../../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (error instanceof z.ZodError) return res.status(422).json({ error: 'Datos inválidos.', issues: error.flatten() });
  console.error('Request failed.', error instanceof Error ? error.message : 'unknown');
  return res.status(500).json({ error: 'No fue posible completar esta operación. Inténtalo de nuevo en unos momentos.' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) app.listen(config.port, () => { console.log('Círculo Inmobiliario escuchando en puerto ' + config.port); });

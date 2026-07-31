import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { config, isProduction } from './config.js';
import { leadSchema, providersSchema } from './schemas.js';
import { analyzeWithAi } from './openai.js';
import { calculateLeadMetrics, matchProperties } from './scoring.js';
import {
  getLeadForConfirmation,
  getProperties,
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

const app = express();
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
  res.json({ ok: true, service: 'circulo-inmobiliario', timestamp: new Date().toISOString(), mode: config.supabaseUrl ? 'supabase' : 'demo', model: config.openaiModel });
});

app.get('/api/demo/properties', async (_req, res, next) => {
  try { res.json(await getProperties()); } catch (error) { next(error); }
});

app.post('/api/leads', submitLimiter, async (req, res, next) => {
  try {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Revisa los campos marcados.', issues: parsed.error.flatten() });
    if (parsed.data.website) return res.status(400).json({ error: 'Solicitud inválida.' });

    const idempotencyKey = String(req.header('Idempotency-Key') || randomUUID()).slice(0, 128);
    const stored = await saveLead(parsed.data, idempotencyKey);
    if (stored.duplicate && stored.responsePayload) return res.json({ ...(stored.responsePayload as object), duplicate: true });

    const inventory = await collectProviderInventory(parsed.data);
    const matches = matchProperties(parsed.data, inventory.properties).slice(0, 12);
    const ai = await analyzeWithAi(parsed.data, matches);
    const metrics = calculateLeadMetrics(parsed.data);
    const found = matches.length > 0;

    let confirmationSent = false;
    let emailWarning = '';
    if (!found) {
      try {
        const emailResult = await sendAdvisorEmail(stored.id, parsed.data, ai.analysis, []);
        confirmationSent = emailResult.sent;
        if (!emailResult.sent) emailWarning = emailResult.reason || 'El correo quedó pendiente de configuración.';
        console.info('Advisor no-match email result.', JSON.stringify(emailResult));
      } catch (emailError) {
        emailWarning = emailError instanceof Error ? emailError.message : 'El correo al asesor quedó pendiente.';
        console.error('Advisor no-match email failed.', emailWarning);
      }
    }

    const responsePayload = {
      leadId: stored.id,
      duplicate: false,
      analysisSource: ai.source,
      metrics,
      analysis: ai.analysis,
      matchCount: matches.length,
      matches,
      sourcesConsulted: inventory.sourcesConsulted,
      confirmationRequired: found,
      confirmationSent,
      emailSent: confirmationSent,
      emailWarning,
      message: found
        ? 'Selecciona las propiedades que te interesan y confirma tu requisición para enviarlas al asesor.'
        : 'Confirmada tu requisición. Un asesor recibió los datos de lo que estás buscando y dará seguimiento a tu solicitud.',
      disclaimer: found
        ? 'Las propiedades proceden de las fuentes configuradas. Revisa el anuncio original y selecciona únicamente las opciones que deseas enviar al asesor.'
        : 'No se localizaron coincidencias verificables en este momento; tu búsqueda quedó registrada para seguimiento manual.',
    };

    await Promise.allSettled([
      updateLeadResult(stored.id, responsePayload, found),
      saveSearch(stored.id, parsed.data, ai.analysis, matches),
    ]).then((results) => results.forEach((result) => {
      if (result.status === 'rejected') console.error('Persistence step failed.', result.reason instanceof Error ? result.reason.message : 'unknown');
    }));

    if (!found) await markLeadConfirmed(stored.id, [], confirmationSent);
    return res.status(201).json(responsePayload);
  } catch (error) { return next(error); }
});

app.post('/api/leads/:leadId/confirm', submitLimiter, async (req, res, next) => {
  try {
    const input = z.object({ selectedPropertyIds: z.array(z.string().min(1).max(180)).min(1).max(12) }).safeParse(req.body);
    if (!input.success) return res.status(422).json({ error: 'Selecciona al menos una propiedad para confirmar tu requisición.' });

    const confirmation = await getLeadForConfirmation(req.params.leadId);
    if (!confirmation) return res.status(404).json({ error: 'No encontramos la requisición. Realiza una nueva búsqueda.' });
    if (confirmation.confirmationSent) {
      return res.json({ confirmed: true, emailSent: true, duplicate: true, selectedPropertyIds: confirmation.selectedPropertyIds, message: 'Tu requisición ya había sido confirmada y enviada al asesor.' });
    }

    const selectedIds = [...new Set(input.data.selectedPropertyIds)];
    const selected = confirmation.matches.filter((match) => selectedIds.includes(match.id));
    if (!selected.length) return res.status(422).json({ error: 'Las propiedades seleccionadas ya no están disponibles en esta consulta.' });

    try {
      const emailResult = await sendAdvisorEmail(req.params.leadId, confirmation.lead, confirmation.analysis, selected);
      await markLeadConfirmed(req.params.leadId, selected.map((item) => item.id), emailResult.sent);
      return res.json({
        confirmed: true,
        emailSent: emailResult.sent,
        selectedPropertyIds: selected.map((item) => item.id),
        message: emailResult.sent
          ? `Confirmada tu requisición. Enviamos al asesor ${selected.length} propiedad(es) seleccionada(s), incluyendo las ligas originales.`
          : 'Confirmada tu requisición. La selección quedó registrada para que el asesor la revise.',
      });
    } catch (emailError) {
      console.error('Advisor selection email failed.', emailError instanceof Error ? emailError.message : 'unknown');
      await markLeadConfirmed(req.params.leadId, selected.map((item) => item.id), false);
      return res.status(202).json({
        confirmed: true,
        emailSent: false,
        selectedPropertyIds: selected.map((item) => item.id),
        message: 'Confirmada tu requisición. La selección quedó registrada; el envío de correo al asesor está pendiente de configuración.',
      });
    }
  } catch (error) { return next(error); }
});

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
    email: getEmailConfigurationStatus(),
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
  return res.status(500).json({ error: 'La requisición no pudo registrarse en este momento. Verifica los datos e inténtalo nuevamente.' });
});

app.listen(config.port, () => { console.log(`Círculo Inmobiliario escuchando en puerto ${config.port}`); });

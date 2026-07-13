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
import { getProperties, getProviders, importProperties, saveLead, saveProviders, saveSearch, updateLeadResult } from './repository.js';
import { collectProviderInventory } from './providers.js';
import { sendAdvisorEmail } from './email.js';
import { issueAdminToken, validateAdminCredentials, verifyAdminToken } from './adminAuth.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: isProduction ? config.clientOrigin.split(',').map((item) => item.trim()) : true, credentials: false }));
app.use(express.json({ limit: '3mb' }));

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const submitLimiter = rateLimit({ windowMs: 30 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
app.use('/api', publicLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'circulo-inmobiliario', timestamp: new Date().toISOString(), mode: config.supabaseUrl ? 'supabase' : 'demo' });
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
    const matches = matchProperties(parsed.data, inventory.properties);
    const ai = await analyzeWithAi(parsed.data, matches);
    const metrics = calculateLeadMetrics(parsed.data);
    const found = matches.length > 0;
    const responsePayload = {
      leadId: stored.id,
      duplicate: false,
      analysisSource: ai.source,
      metrics,
      analysis: ai.analysis,
      matchCount: matches.length,
      sourcesConsulted: inventory.sourcesConsulted,
      message: found
        ? 'Hemos encontrado opciones relacionadas con tu solicitud. Un asesor las revisará y te las hará llegar en breve.'
        : 'Muchas gracias por aceptar nuestras políticas. Un asesor revisará tu solicitud y estará en contacto contigo.',
      disclaimer: 'Las propiedades no se muestran directamente al cliente hasta que un asesor confirme disponibilidad, precio y condiciones.',
    };

    await updateLeadResult(stored.id, responsePayload, found);
    await saveSearch(stored.id, parsed.data, ai.analysis, matches);
    try { await sendAdvisorEmail(stored.id, parsed.data, ai.analysis, matches); }
    catch (emailError) { console.error('Advisor email failed.', emailError instanceof Error ? emailError.message : 'unknown'); }
    return res.status(201).json(responsePayload);
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
  return res.status(500).json({ error: 'No fue posible completar la solicitud. Intenta nuevamente.' });
});

app.listen(config.port, () => { console.log(`Círculo Inmobiliario escuchando en puerto ${config.port}`); });

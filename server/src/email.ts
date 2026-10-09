import { Resend } from 'resend';
import { config } from './config.js';
import type { LeadInput, MatchResult, SearchSnapshot } from './schemas.js';
import { propertyLabel } from './scoring.js';

const escapeHtml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const senderDomain = (sender: string) => sender.match(/@([a-z0-9.-]+)/i)?.[1].toLowerCase() || '';
const publicDomains = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.mx', 'live.com', 'resend.dev']);
const approvedDomains = ['circulointernacionalveracruz.org', 'circulointernacional.com'];
let senderCache: { sender: string; expires: number } | null = null;
let lastConfigurationWarning = { message: '', at: 0 };

export async function resolveEmailSender(): Promise<string> {
  const domain = senderDomain(config.emailFrom);
  if (domain && !publicDomains.has(domain)) return config.emailFrom;
  if (senderCache && senderCache.expires > Date.now()) return senderCache.sender;
  if (!config.resendApiKey) throw new Error('Falta configurar RESEND_API_KEY.');
  const domains = await new Resend(config.resendApiKey).domains.list();
  if (domains.error) throw new Error('Configura EMAIL_FROM con un correo de un dominio propio verificado en Resend. Gmail y Hotmail son destinatarios, no remitentes de Resend.');
  const verified = domains.data?.data.find(item => item.status === 'verified' && approvedDomains.some(approved => item.name === approved || item.name.endsWith('.' + approved)));
  if (!verified) throw new Error('Verifica un dominio de Círculo en Resend y configura EMAIL_FROM. El dominio actual del remitente no permite enviar estos reportes.');
  const sender = 'Círculo Internacional <solicitudes@' + verified.name + '>';
  senderCache = { sender, expires: Date.now() + 5 * 60 * 1000 };
  return sender;
}

export async function getEmailConfigurationStatus() {
  let sender = config.emailFrom, configurationMessage = '';
  try { if (config.resendApiKey) sender = await resolveEmailSender(); else configurationMessage = 'Falta configurar RESEND_API_KEY.'; }
  catch (error) { configurationMessage = error instanceof Error ? error.message : 'Revisa el remitente de correo.'; }
  if (configurationMessage && (lastConfigurationWarning.message !== configurationMessage || Date.now() - lastConfigurationWarning.at > 5 * 60 * 1000)) {
    console.warn('Advisor email configuration:', configurationMessage);
    lastConfigurationWarning = { message: configurationMessage, at: Date.now() };
  }
  return { configured: Boolean(config.resendApiKey && senderDomain(sender) && !configurationMessage), recipient: config.advisorEmails.join(', '), recipients: config.advisorEmails, sender, provider: 'Resend', verifiedSenderRequired: Boolean(configurationMessage), configurationMessage };
}

export async function sendTestEmail() {
  const sender = await resolveEmailSender();
  const result = await new Resend(config.resendApiKey).emails.send({ from: sender, to: config.advisorEmails, subject: 'Prueba de correo — Círculo Internacional', html: '<p>Esta prueba confirma la conexión de los reportes para ambos asesores de Círculo Internacional.</p>' });
  if (result.error) throw new Error(result.error.message);
  return { sent: true, id: result.data?.id, recipient: config.advisorEmails.join(', '), recipients: config.advisorEmails };
}

export function buildAdvisorReport(leadId: string, lead: LeadInput, snapshot: SearchSnapshot, selected: MatchResult[]) {
  const rows: [string, string][] = [
    ['Operación', lead.transactionType === 'rent' ? 'Renta' : 'Compra'], ['Tipo', propertyLabel(lead.propertyType)],
    ['Ciudad o municipio', lead.city], ['Zonas', lead.neighborhoods.join(', ') || 'Zona abierta'],
    ['Presupuesto', currency(lead.budgetMin) + ' a ' + currency(lead.budgetMax) + (lead.transactionType === 'rent' ? ' mensuales' : '')],
    ['Recámaras / baños / estacionamientos mínimos', [lead.bedrooms, lead.bathrooms, lead.parking].join(' / ')],
    ['Terreno / construcción mínimos (m²)', [lead.landAreaMin || 0, lead.constructionAreaMin || 0].join(' / ')],
    ['Plantas', lead.floors === 'indifferent' ? 'Indistintas' : lead.floors],
    ['Patio / jardín / alberca indispensables', [lead.yard ? 'Patio' : '', lead.garden ? 'Jardín' : '', lead.pool ? 'Alberca' : ''].filter(Boolean).join(', ') || 'Sin preferencia'],
    ['Indispensables', lead.essentialFeatures.join(', ') || 'Sin adicionales'], ['Deseables', [...lead.amenities, ...lead.desirableFeatures].join(', ') || 'Sin adicionales'],
    ['Mobiliario', lead.furnished || 'Indistinto'], ['Inicio / entrega deseada', lead.moveInDate || lead.delivery || 'Por definir'],
    ['Inquilinos / contrato', String(lead.tenants || 'Por definir') + ' / ' + (lead.contractMonths ? lead.contractMonths + ' meses' : 'Por definir')],
    ['Mascotas', lead.hasPets ? lead.petDetails : 'No indicadas'], ['Forma de pago', lead.paymentMethod || 'Por definir'],
    ['Crédito preaprobado / monto', (lead.creditPreapproved ? 'Sí' : 'Por confirmar') + ' / ' + currency(lead.creditAmount || 0)],
    ['Garantía / factura', (lead.guarantee || 'Por definir') + ' / ' + (lead.invoiceRequired ? 'Requiere factura' : 'No solicitada')],
    ['Comentarios', lead.comments || 'Sin comentarios'],
  ];
  const cards = selected.map((property, index) => '<div style="border:1px solid #ddd;border-left:4px solid #f51524;padding:16px;margin:12px 0;border-radius:10px"><h3>' + (index + 1) + '. ' + escapeHtml(property.title) + '</h3><p><strong>' + currency(property.price) + '</strong>' + (property.transactionType === 'rent' ? ' / mes' : '') + ' · ' + escapeHtml([property.neighborhood, property.city].filter(Boolean).join(', ')) + '</p><p>' + (property.matchType === 'exact' ? 'Coincide con los criterios publicados.' : 'Alternativa: ' + escapeHtml(property.gaps.join('; '))) + '</p><p>Fuente: ' + escapeHtml(property.sourceName) + ' · Consultada: ' + escapeHtml(property.verifiedAt) + '</p><a href="' + escapeHtml(property.sourceUrl) + '" style="color:#d61220">Abrir propiedad seleccionada</a><p style="font-size:12px;overflow-wrap:anywhere">' + escapeHtml(property.sourceUrl) + '</p></div>').join('');
  const html = '<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;color:#171717;border-top:6px solid #f51524;padding:24px"><h1>Cliente solicita asesoría inmobiliaria</h1><p>Folio: ' + escapeHtml(leadId) + ' · Consulta: ' + escapeHtml(snapshot.createdAt) + '</p><h2>Contacto autorizado</h2><p>' + escapeHtml(lead.fullName) + '<br>' + escapeHtml(lead.phone) + (lead.email ? '<br>' + escapeHtml(lead.email) : '') + '</p><p>El cliente pidió contacto y aceptó el aviso de privacidad. Su consulta previa no generó envíos.</p><h2>Necesidades del cliente</h2><table style="width:100%;border-collapse:collapse">' + rows.map(([label, value]) => '<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #eee">' + escapeHtml(label) + '</th><td style="padding:8px;border-bottom:1px solid #eee">' + escapeHtml(value) + '</td></tr>').join('') + '</table><h2>Resultado</h2><p>' + escapeHtml(snapshot.analysis.headline) + '</p><p>' + escapeHtml(snapshot.analysis.explanation) + '</p><p>' + snapshot.matches.length + ' coincidencias · ' + snapshot.alternatives.length + ' alternativas · ' + snapshot.sourcesConsulted + ' fuentes consultadas</p>' + (snapshot.warnings.length ? '<ul>' + snapshot.warnings.map(warning => '<li>' + escapeHtml(warning) + '</li>').join('') + '</ul>' : '') + '<h2>Propiedades que interesaron al cliente (' + selected.length + ')</h2>' + (cards || '<p>El cliente no seleccionó anuncios. Solicita asesoría para continuar o ampliar la búsqueda.</p>') + '<h2>Alternativas respaldadas por anuncios</h2>' + (snapshot.adjustments.length ? '<ul>' + snapshot.adjustments.map(adjustment => '<li>' + escapeHtml(adjustment.label + ': ' + adjustment.explanation) + '</li>').join('') + '</ul>' : '<p>No hay información suficiente para recomendar un precio o una zona distinta.</p>') + '<p style="font-size:12px;color:#666">Confirma disponibilidad, precio, características faltantes y condiciones con la fuente antes de proponer una visita.</p></div>';
  const text = ['Cliente solicita contacto: ' + lead.fullName, 'Teléfono: ' + lead.phone, 'Correo: ' + lead.email, 'Folio: ' + leadId, ...rows.map(([label, value]) => label + ': ' + value), snapshot.analysis.headline, 'Propiedades seleccionadas:', ...selected.map(property => property.title + ' | ' + currency(property.price) + ' | ' + property.sourceUrl + (property.gaps.length ? ' | Diferencias: ' + property.gaps.join('; ') : '')), ...snapshot.adjustments.map(adjustment => adjustment.label + ': ' + adjustment.explanation)].join('\n');
  return { html, text };
}

export async function sendAdvisorEmail(leadId: string, lead: LeadInput, snapshot: SearchSnapshot, selected: MatchResult[]) {
  if (!lead.contactAccepted || !lead.privacyAccepted) throw new Error('Falta la autorización de contacto.');
  const sender = await resolveEmailSender();
  const report = buildAdvisorReport(leadId, lead, snapshot, selected);
  const result = await new Resend(config.resendApiKey).emails.send({
    from: sender, to: config.advisorEmails, ...(lead.email ? { replyTo: lead.email } : {}),
    subject: 'Solicitud de asesoría · ' + lead.fullName + ' · ' + selected.length + (selected.length === 1 ? ' propiedad de interés' : ' propiedades de interés'),
    html: report.html, text: report.text,
  }, { idempotencyKey: 'contact-' + leadId });
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.id) throw new Error('El proveedor no confirmó la recepción del reporte.');
  return { sent: true, id: result.data.id, recipients: config.advisorEmails };
}

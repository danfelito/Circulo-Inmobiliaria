import { Resend } from 'resend';
import { config } from './config.js';
import type { AiAnalysis, LeadInput, MatchResult } from './schemas.js';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

export function getEmailConfigurationStatus() {
  return {
    configured: Boolean(config.resendApiKey && config.emailFrom),
    recipient: config.advisorEmail,
    sender: config.emailFrom,
    provider: 'Resend',
    verifiedSenderRequired: config.emailFrom.includes('@resend.dev'),
  };
}

export async function sendTestEmail() {
  if (!config.resendApiKey) throw new Error('RESEND_API_KEY no está configurada en Render.');
  const resend = new Resend(config.resendApiKey);
  const result = await resend.emails.send({
    from: config.emailFrom,
    to: [config.advisorEmail],
    subject: 'Prueba de correo — Círculo Internacional de Bienes Raíces',
    html: '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><div style="border-top:6px solid #f51524;padding-top:18px"><h1>Prueba de correo correcta</h1></div><p>Este mensaje confirma que Render, Resend y el correo del asesor están conectados.</p></div>',
  });
  if (result.error) throw new Error(result.error.message);
  return { sent: true, id: result.data?.id, recipient: config.advisorEmail };
}

export async function sendAdvisorEmail(leadId: string, lead: LeadInput, analysis: AiAnalysis, matches: MatchResult[]) {
  if (!config.resendApiKey) return { sent: false, mode: 'demo' as const, reason: 'RESEND_API_KEY no configurada' };
  const resend = new Resend(config.resendApiKey);
  const properties = matches.slice(0, 12).map((match, index) => `
    <div style="border:1px solid #e3e3e3;border-left:4px solid #f51524;border-radius:10px;padding:16px;margin:0 0 14px">
      <p style="margin:0 0 8px"><strong>${index + 1}. ${escapeHtml(match.title)}</strong> · ${match.matchScore}% de coincidencia</p>
      <p style="margin:0 0 8px">${currency(match.price)} · ${escapeHtml(match.city)}${match.neighborhood ? `, ${escapeHtml(match.neighborhood)}` : ''}</p>
      <p style="margin:0 0 8px">${match.bedrooms} recámara(s) · ${match.bathrooms} baño(s) · ${match.parking} estacionamiento(s) · ${match.constructionArea || match.landArea || 0} m²</p>
      <p style="margin:0 0 8px"><strong>Características:</strong> ${escapeHtml(match.amenities.join(', ') || 'Sin amenidades verificadas')}</p>
      <p style="margin:0 0 8px"><strong>Fuente:</strong> ${escapeHtml(match.sourceName)}</p>
      ${match.sourceUrl && match.sourceUrl !== '#' ? `<a href="${escapeHtml(match.sourceUrl)}" style="color:#d61220;font-weight:700">Abrir anuncio original</a>` : '<span style="color:#777">Catálogo interno o demostrativo</span>'}
    </div>
  `).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;color:#171717">
      <div style="border-top:6px solid #f51524;padding-top:18px"><h1 style="font-size:23px;margin:0 0 18px">Nueva requisición inmobiliaria confirmada</h1></div>
      <p><strong>Folio:</strong> ${escapeHtml(leadId)}</p>
      <h2 style="font-size:17px">Cliente</h2>
      <p>${escapeHtml(lead.fullName)} · ${escapeHtml(lead.email)} · ${escapeHtml(lead.phone)}</p>
      <h2 style="font-size:17px">Lo que está buscando</h2>
      <p>${lead.transactionType === 'rent' ? 'Renta' : 'Compra'} de ${escapeHtml(lead.propertyType)} en ${escapeHtml(lead.city)}.<br>
      Presupuesto: ${currency(lead.budgetMin)} a ${currency(lead.budgetMax)}. Recámaras: ${lead.bedrooms}. Zonas: ${escapeHtml(lead.neighborhoods.join(', ') || 'abierta')}.</p>
      ${lead.essentialFeatures.length ? `<p><strong>Indispensable:</strong> ${escapeHtml(lead.essentialFeatures.join(', '))}</p>` : ''}
      ${lead.desirableFeatures.length ? `<p><strong>Deseable:</strong> ${escapeHtml(lead.desirableFeatures.join(', '))}</p>` : ''}
      ${lead.comments ? `<p><strong>Comentarios:</strong> ${escapeHtml(lead.comments)}</p>` : ''}
      <h2 style="font-size:17px">Análisis</h2>
      <p><strong>${escapeHtml(analysis.headline)}</strong></p><p>${escapeHtml(analysis.explanation)}</p>
      <p><strong>Resumen para asesor:</strong> ${escapeHtml(analysis.advisorSummary)}</p>
      <h2 style="font-size:17px">${matches.length ? 'Propiedades seleccionadas por el cliente' : 'Resultado de la búsqueda'}</h2>
      ${properties || '<p>No se localizaron coincidencias verificables. La requisición del cliente queda enviada para búsqueda y seguimiento manual.</p>'}
      <h2 style="font-size:17px">Alternativas sugeridas</h2>
      <ul>${analysis.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p style="font-size:12px;color:#667085">Verifica disponibilidad, precio y condiciones directamente en la fuente antes de contactar al cliente.</p>
    </div>`;

  const result = await resend.emails.send({
    from: config.emailFrom,
    to: [config.advisorEmail],
    subject: matches.length
      ? `Cliente interesado en ${matches.length} propiedad(es) — ${lead.fullName}`
      : `Requisición sin coincidencias — ${lead.fullName}`,
    html,
  });
  if (result.error) throw new Error(result.error.message);
  return { sent: true, mode: 'resend' as const, id: result.data?.id, recipient: config.advisorEmail };
}

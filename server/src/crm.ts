import { createHash } from 'node:crypto';
import { config } from './config.js';
import type { LeadInput } from './schemas.js';

export type CrmSyncResult = { synced: boolean; skipped?: boolean; status?: number; error?: string };

// Same search → same CRM requestId, so retries and Render restarts never duplicate the contact.
export function crmRequestId(searchId: string): string {
  const hex = createHash('sha256').update('circulo-buscador:' + searchId).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), '4' + hex.slice(13, 16), '8' + hex.slice(17, 20), hex.slice(20, 32)].join('-');
}

export function buildCrmInquiry(searchId: string, lead: LeadInput, reportText: string) {
  return {
    requestId: crmRequestId(searchId),
    name: lead.fullName.slice(0, 180),
    email: lead.email || '',
    phone: lead.phone,
    message: ('Prospecto del buscador inteligente\n' + reportText).slice(0, 5000),
    attribution: { utm_source: 'buscador', utm_medium: 'web', utm_campaign: lead.transactionType === 'rent' ? 'buscador-renta' : 'buscador-compra', utm_content: lead.city.slice(0, 160) },
  };
}

/** Registers the prospect in the Círculo CRM (Cloudflare D1). Never throws: the advisor email remains the primary channel. */
export async function syncLeadToCrm(searchId: string, lead: LeadInput, reportText: string, fetchImpl: typeof fetch = fetch): Promise<CrmSyncResult> {
  if (!config.crmInquiryUrl) return { synced: false, skipped: true };
  try {
    const response = await fetchImpl(config.crmInquiryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'circulo-buscador/1.0' },
      body: JSON.stringify(buildCrmInquiry(searchId, lead, reportText)),
      signal: AbortSignal.timeout(10_000),
    });
    // 409 = this search was already registered with an earlier selection; the contact exists.
    if (response.ok || response.status === 409) return { synced: true, status: response.status };
    const error = await response.text().catch(() => '');
    console.warn('CRM sync rejected.', response.status, error.slice(0, 200));
    return { synced: false, status: response.status, error: error.slice(0, 200) };
  } catch (error) {
    console.warn('CRM sync failed.', error instanceof Error ? error.message : 'unknown');
    return { synced: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

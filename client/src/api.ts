import type { ConfirmationResponse, ContactForm, LeadForm, SearchResponse } from './types';
const splitFeatures = (value: string) => value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean);

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = data?.issues?.fieldErrors as Record<string, string[]> | undefined;
    const detail = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
    throw new Error(data.message || detail || data.error || 'No fue posible completar la operación.');
  }
  return data;
}

export async function submitSearch(form: LeadForm, idempotencyKey: string): Promise<SearchResponse> {
  const payload = { ...form, neighborhoods: [form.neighborhood1, form.neighborhood2, form.neighborhood3].map(item => item.trim()).filter(Boolean), essentialFeatures: splitFeatures(form.essentialText), desirableFeatures: splitFeatures(form.desirableText) };
  return readJson(await fetch('/api/searches', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) }));
}

export async function requestAdvisorContact(result: SearchResponse, selectedPropertyIds: string[], contact: ContactForm): Promise<ConfirmationResponse> {
  return readJson(await fetch('/api/searches/' + encodeURIComponent(result.searchId) + '/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactToken: result.contactToken, selectedPropertyIds, contact }) }));
}

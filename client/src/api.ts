import type { LeadForm, SearchResponse } from './types';

const splitFeatures = (value: string) => value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);

export async function submitLead(form: LeadForm, idempotencyKey: string): Promise<SearchResponse> {
  const payload = {
    ...form,
    neighborhoods: [form.neighborhood1, form.neighborhood2, form.neighborhood3].map((item) => item.trim()).filter(Boolean),
    essentialFeatures: splitFeatures(form.essentialText),
    desirableFeatures: splitFeatures(form.desirableText),
  };
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const fieldErrors = data?.issues?.fieldErrors as Record<string, string[]> | undefined;
    const detail = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
    throw new Error(detail || data.error || 'No fue posible enviar la solicitud.');
  }
  return data as SearchResponse;
}

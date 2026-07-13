import { describe, expect, it } from 'vitest';
import { saveLead } from './repository.js';
import type { LeadInput } from './schemas.js';

const lead: LeadInput = {
  transactionType: 'buy', fullName: 'Prueba Idempotencia', email: 'idempotencia@example.com', phone: '2290000000',
  hasPets: false, petDetails: '', moveInDate: '', propertyType: 'apartment', floors: 'indifferent', bedrooms: 2, bathrooms: 1,
  parking: 1, yard: false, garden: false, pool: false, amenities: [], delivery: 'indifferent', paymentMethod: 'cash', city: 'Boca del Río',
  neighborhoods: [], budgetMin: 1000000, budgetMax: 3000000, essentialFeatures: [], desirableFeatures: [], comments: '',
  privacyAccepted: true, contactAccepted: true, website: '',
};

describe('idempotencia', () => {
  it('devuelve el mismo lead para la misma llave', async () => {
    const key = `test-${Date.now()}`;
    const first = await saveLead(lead, key);
    const second = await saveLead(lead, key);
    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
  });
});

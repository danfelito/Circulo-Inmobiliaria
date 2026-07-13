import { describe, expect, it } from 'vitest';
import { leadSchema } from './schemas.js';

const common = {
  transactionType: 'rent', fullName: 'Cliente Prueba', email: 'cliente@example.com', phone: '2290000000', tenants: 2,
  hasPets: false, petDetails: '', moveInDate: '2026-08-01', contractMonths: 12, propertyType: 'house', furnished: 'indifferent',
  floors: 'indifferent', bedrooms: 3, bathrooms: 2, parking: 1, yard: false, garden: false, pool: false, amenities: [],
  invoiceRequired: false, guarantee: 'advice', city: 'Boca del Río', neighborhoods: [], budgetMin: 10000, budgetMax: 25000,
  essentialFeatures: [], desirableFeatures: [], comments: '', privacyAccepted: true, contactAccepted: true, website: '',
};

describe('validación de solicitud', () => {
  it('acepta una renta coherente', () => expect(leadSchema.safeParse(common).success).toBe(true));
  it('rechaza máximo menor al mínimo', () => expect(leadSchema.safeParse({ ...common, budgetMin: 30000 }).success).toBe(false));
  it('rechaza mascotas sin detalle', () => expect(leadSchema.safeParse({ ...common, hasPets: true }).success).toBe(false));
});

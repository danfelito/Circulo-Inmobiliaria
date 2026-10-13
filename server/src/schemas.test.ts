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
  it('rechaza mascotas sin cantidad ni tipo en una renta', () => expect(leadSchema.safeParse({ ...common, hasPets: true }).success).toBe(false));
  it('exige cantidad y tipo cuando se marcan mascotas', () => {
    expect(leadSchema.safeParse({ ...common, hasPets: true, petCount: 2, petType: 'Gatos' }).success).toBe(true);
    expect(leadSchema.safeParse({ ...common, hasPets: true, petCount: 0, petType: 'Perro' }).success).toBe(false);
    expect(leadSchema.safeParse({ ...common, hasPets: true, petCount: 1, petType: '' }).success).toBe(false);
  });
  it('permite seleccionar fiador y póliza jurídica a la vez', () => {
    const parsed = leadSchema.safeParse({ ...common, hasGuarantor: true, hasLegalPolicy: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect([parsed.data.hasGuarantor, parsed.data.hasLegalPolicy]).toEqual([true, true]);
  });
  it('no exige datos de mascotas al comprar', () => expect(leadSchema.safeParse({ ...common, transactionType: 'buy', hasPets: true }).success).toBe(true));
});

import { describe, expect, it } from 'vitest';
import { demoProperties } from './demoData.js';
import { deterministicAnalysis, matchProperties } from './scoring.js';
import type { LeadInput } from './schemas.js';

const baseLead: LeadInput = {
  transactionType: 'buy', fullName: 'Cliente de Prueba', email: 'cliente@example.com', phone: '2290000000',
  hasPets: false, petDetails: '', moveInDate: '', propertyType: 'house', floors: 'indifferent', bedrooms: 4, bathrooms: 2,
  parking: 2, yard: true, garden: false, pool: false, amenities: [], city: 'Medellín de Bravo', neighborhoods: ['El Tejar'],
  budgetMin: 1500000, budgetMax: 2500000, essentialFeatures: [], desirableFeatures: [], comments: '', privacyAccepted: true,
  contactAccepted: true, website: '', paymentMethod: 'cash',
};

describe('matching inmobiliario', () => {
  it('prioriza una propiedad compatible', () => {
    const matches = matchProperties(baseLead, demoProperties);
    expect(matches[0]?.id).toBe('demo-buy-3');
    expect(matches[0]?.matchScore).toBeGreaterThan(70);
  });

  it('genera alternativas cuando no hay coincidencias', () => {
    const impossible = { ...baseLead, budgetMax: 200000, neighborhoods: ['Zona inexistente'], pool: true };
    const matches: ReturnType<typeof matchProperties> = [];
    const analysis = deterministicAnalysis(impossible, matches);
    expect(analysis.suggestions.length).toBeGreaterThan(0);
    expect(analysis.viability).toBe('low');
  });
});

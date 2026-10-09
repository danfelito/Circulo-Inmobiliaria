import { criteriaSchema, leadSchema, type Property, type SearchSnapshot } from './schemas.js';
import { rankProperties, deterministicAnalysis } from './scoring.js';
export const criteria = criteriaSchema.parse({ transactionType: 'buy', propertyType: 'house', city: 'Boca del Río', neighborhoods: ['Costa de Oro'], budgetMin: 1_000_000, budgetMax: 2_500_000, bedrooms: 3, bathrooms: 2, parking: 1 });
export const lead = leadSchema.parse({ ...criteria, fullName: 'Cliente de Prueba', phone: '2290000000', email: 'cliente@example.com', privacyAccepted: true, contactAccepted: true });
export const property: Property = { id: 'real-1', title: 'Casa publicada', transactionType: 'buy', propertyType: 'house', city: 'Boca del Río', neighborhood: 'Costa de Oro', price: 2_000_000, bedrooms: 3, bathrooms: 2, parking: 1, landArea: 200, constructionArea: 160, floors: 2, yard: true, garden: false, pool: false, amenities: ['Estudio'], sourceName: 'Fuente de prueba', sourceUrl: 'https://example.com/propiedades/casa-publicada', verifiedAt: new Date().toISOString(), demo: false };
export function snapshot(): SearchSnapshot {
  const ranked = rankProperties(criteria, [property]);
  return { searchId: crypto.randomUUID(), createdAt: new Date().toISOString(), criteria, ...ranked, analysis: deterministicAnalysis(criteria, ranked.matches, ranked.alternatives, ranked.adjustments), sourcesConsulted: 1, warnings: [] };
}

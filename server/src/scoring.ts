import type { AiAnalysis, MatchResult, Property, SearchAdjustment, SearchCriteria } from './schemas.js';

export const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const samePlace = (a: string, b: string) => Boolean(norm(a) && norm(b)) && norm(a) === norm(b);
const contains = (text: string, term: string) => Boolean(norm(term)) && ` ${norm(text)} `.includes(` ${norm(term)} `);
const known = (property: Property, field: string) => !property.verifiedFields || property.verifiedFields.includes(field);
const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
export const propertyLabel = (value: string) => ({ house: 'Casa', apartment: 'Departamento', land: 'Terreno', retail: 'Local', office: 'Oficina', warehouse: 'Bodega', ranch: 'Rancho' }[value] || value);

export function calculateLeadMetrics(criteria: SearchCriteria) {
  const relevant = [criteria.propertyType, criteria.city, criteria.budgetMax];
  const rigidCount = criteria.neighborhoods.length + criteria.essentialFeatures.length + Number(criteria.pool) + Number(criteria.garden) + Number(criteria.yard);
  return { completeness: Math.round(relevant.filter(Boolean).length / relevant.length * 100), rigidity: rigidCount >= 7 ? 'high' : rigidCount >= 4 ? 'medium' : 'low', contradictions: criteria.budgetMin > criteria.budgetMax ? ['El presupuesto mínimo supera al máximo.'] : [] };
}

export function scoreProperty(criteria: SearchCriteria, property: Property): MatchResult {
  const reasons: string[] = [];
  const gaps: string[] = [];
  const adjustments = new Set<MatchResult['adjustments'][number]>();
  const gap = (text: string, adjustment: MatchResult['adjustments'][number]) => { gaps.push(text); adjustments.add(adjustment); };
  if (samePlace(criteria.city, property.city)) reasons.push('En el municipio solicitado');
  else gap(`Otra localidad: ${property.city}`, 'location');
  if (criteria.neighborhoods.length) {
    if (criteria.neighborhoods.some(zone => samePlace(property.neighborhood, zone) || contains(property.locationText || '', zone))) reasons.push('Zona coincidente en la ubicación publicada');
    else gap(property.neighborhood ? `Otra zona: ${property.neighborhood}` : 'La colonia solicitada no está confirmada en el anuncio', 'location');
  }
  if (property.price > criteria.budgetMax) gap(`Supera tu máximo por ${currency(property.price - criteria.budgetMax)}`, 'budget');
  else if (property.price < criteria.budgetMin) gap(`Precio publicado inferior a tu mínimo: ${currency(property.price)}`, 'budget');
  else reasons.push('Dentro de tu presupuesto');

  const minimum = (field: 'bedrooms' | 'bathrooms' | 'parking' | 'landArea' | 'constructionArea', required: number, label: string) => {
    if (!required) return;
    if (!known(property, field)) gap(`${label}: dato por confirmar`, 'features');
    else if (property[field] < required) gap(`${label}: ${property[field]} publicados; pides al menos ${required}`, 'features');
    else reasons.push(`Cumple ${label.toLowerCase()}`);
  };
  if (['house', 'apartment'].includes(criteria.propertyType)) {
    minimum('bedrooms', criteria.bedrooms, 'Recámaras');
    minimum('bathrooms', criteria.bathrooms, 'Baños');
  }
  if (criteria.propertyType !== 'land') minimum('parking', criteria.parking, 'Estacionamientos');
  minimum('landArea', criteria.landAreaMin || 0, 'Terreno (m²)');
  if (criteria.propertyType !== 'land') minimum('constructionArea', criteria.constructionAreaMin || 0, 'Construcción (m²)');
  for (const [field, label] of [['yard', 'Patio'], ['garden', 'Jardín'], ['pool', 'Alberca']] as const) {
    if (!criteria[field]) continue;
    if (!known(property, field)) gap(`${label}: dato por confirmar`, 'features');
    else if (!property[field]) gap(`No cumple ${label.toLowerCase()}`, 'features');
    else reasons.push(`${label} publicada`);
  }
  if (criteria.floors !== 'indifferent') {
    if (!known(property, 'floors')) gap('Número de plantas por confirmar', 'features');
    else if (property.floors !== Number(criteria.floors)) gap(`Plantas: ${property.floors}; pides ${criteria.floors}`, 'features');
  }
  if (criteria.furnished && criteria.furnished !== 'indifferent') {
    if (!property.furnished) gap('Mobiliario por confirmar', 'features');
    else if (property.furnished !== criteria.furnished) gap('El mobiliario publicado es distinto al solicitado', 'features');
  }
  for (const feature of criteria.essentialFeatures) {
    if (property.amenities.some(item => !/^(sin|no)\b/.test(norm(item)) && contains(item, feature))) reasons.push(`Indispensable publicado: ${feature}`);
    else gap(`Indispensable por confirmar: ${feature}`, 'features');
  }
  const preferred = criteria.amenities.filter(item => property.amenities.some(value => contains(value, item))).length;
  return { ...property, matchScore: Math.max(0, Math.min(100, 100 - gaps.length * 12 + preferred)), reasons, gaps, adjustments: [...adjustments], matchType: gaps.length ? 'alternative' : 'exact', availabilityLabel: 'Anuncio localizado · disponibilidad por confirmar' };
}

export function rankProperties(criteria: SearchCriteria, properties: Property[]) {
  const real = properties.filter(property => !property.demo && property.price > 0 && property.transactionType === criteria.transactionType && property.propertyType === criteria.propertyType && /^https?:\/\//.test(property.sourceUrl));
  const ranked = real.map(property => scoreProperty(criteria, property)).sort((a, b) => b.matchScore - a.matchScore || a.price - b.price);
  const matches = ranked.filter(property => property.matchType === 'exact').slice(0, 12);
  const alternatives = ranked.filter(property => property.matchType === 'alternative' && (!matches.length || property.price <= criteria.budgetMax))
    .sort((a, b) => Number(samePlace(criteria.city, b.city)) - Number(samePlace(criteria.city, a.city)) || b.matchScore - a.matchScore || Math.abs(a.price - criteria.budgetMax) - Math.abs(b.price - criteria.budgetMax)).slice(0, 8);
  return { matches, alternatives, adjustments: buildAdjustments(criteria, [...matches, ...alternatives], !matches.length) };
}

export function matchProperties(criteria: SearchCriteria, properties: Property[]) { return rankProperties(criteria, properties).matches; }

function buildAdjustments(criteria: SearchCriteria, ranked: MatchResult[], suggestBudget: boolean): SearchAdjustment[] {
  const adjustments: SearchAdjustment[] = [];
  const higher = ranked.filter(property => property.adjustments.length === 1 && property.adjustments[0] === 'budget' && property.price > criteria.budgetMax).sort((a, b) => a.price - b.price);
  if (higher.length && suggestBudget) {
    const first = higher[0];
    adjustments.push({ id: 'budget', label: `Revisar un máximo de ${currency(first.price)}`, explanation: `Hay un anuncio que cumple tus demás criterios a partir de ${currency(first.price)}${criteria.transactionType === 'rent' ? ' al mes' : ''}. Es un precio publicado, no una valuación.`, propertyIds: [first.id], changes: { budgetMax: first.price } });
  }
  const elsewhere = ranked.filter(property => property.adjustments.length === 1 && property.adjustments[0] === 'location');
  const zones = new Map<string, MatchResult[]>();
  for (const property of elsewhere) {
    if (samePlace(criteria.city, property.city) && !property.neighborhood) continue;
    const key = `${property.city}|${property.neighborhood}`;
    zones.set(key, [...(zones.get(key) || []), property]);
  }
  for (const group of [...zones.values()].slice(0, 3)) {
    const first = group[0];
    const location = [first.neighborhood, first.city].filter(Boolean).join(', ');
    adjustments.push({ id: `location-${first.id}`, label: `Buscar en ${location}`, explanation: `${group.length} anuncio(s) cumple(n) tus demás criterios en esta ubicación, dentro de tu presupuesto.`, propertyIds: group.map(property => property.id), changes: { city: first.city, neighborhoods: first.neighborhood ? [first.neighborhood] : [] } });
  }
  return adjustments;
}

export function deterministicAnalysis(criteria: SearchCriteria, matches: MatchResult[], alternatives: MatchResult[] = [], adjustments: SearchAdjustment[] = []): AiAnalysis {
  const found = matches.length > 0;
  return {
    viability: found ? 'high' : alternatives.length ? 'medium' : 'insufficient_data',
    headline: found ? `${matches.length} anuncio(s) coincide(n) con tus criterios.` : alternatives.length ? 'Encontramos alternativas con diferencias que debes revisar.' : 'No encontramos anuncios verificables con esta combinación.',
    explanation: found ? 'Estas opciones cumplen el presupuesto, la ubicación y las características comparables publicadas. Un asesor confirmará su disponibilidad y las condiciones de la operación.' : alternatives.length ? 'Las alternativas muestran precios y ubicaciones publicados. En cada ficha indicamos qué cambia o qué dato falta por confirmar; ninguna se presenta como coincidencia exacta.' : 'Este resultado describe únicamente las fuentes consultadas. No demuestra que no existan opciones en todo el mercado. Puedes cambiar tus criterios o solicitar una búsqueda con un asesor.',
    pressurePoints: [...new Set(alternatives.flatMap(property => property.gaps))].slice(0, 6),
    suggestions: adjustments.length ? adjustments.map(item => item.explanation) : [found ? 'Selecciona las propiedades que te interesen y solicita contacto cuando lo decidas.' : 'Solicita al asesor ampliar la búsqueda; no hay evidencia suficiente para recomendar otro precio o zona.'],
    advisorSummary: `${criteria.transactionType === 'rent' ? 'Renta' : 'Compra'} de ${propertyLabel(criteria.propertyType)} en ${criteria.city}; presupuesto ${currency(criteria.budgetMin)} a ${currency(criteria.budgetMax)}${criteria.transactionType === 'rent' ? ' mensuales' : ''}; zonas: ${criteria.neighborhoods.join(', ') || 'abierta'}. ${matches.length} coincidencias y ${alternatives.length} alternativas localizadas.`,
  };
}

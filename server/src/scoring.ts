import type { AiAnalysis, LeadInput, MatchResult, Property } from './schemas.js';

const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function calculateLeadMetrics(lead: LeadInput) {
  const relevant = [
    lead.fullName, lead.email, lead.phone, lead.propertyType, lead.city, lead.budgetMax,
    lead.transactionType === 'rent' ? lead.moveInDate : lead.paymentMethod,
  ];
  const completeness = Math.round((relevant.filter(Boolean).length / relevant.length) * 100);
  const rigidCount = lead.neighborhoods.length + lead.essentialFeatures.length + Number(lead.pool) + Number(lead.garden) + Number(lead.yard);
  const rigidity = rigidCount >= 7 ? 'high' : rigidCount >= 4 ? 'medium' : 'low';
  const contradictions: string[] = [];
  if (lead.budgetMin > lead.budgetMax) contradictions.push('El presupuesto mínimo supera al máximo.');
  if (lead.propertyType === 'land' && lead.bedrooms > 0) contradictions.push('Se solicitaron recámaras para un terreno.');
  if (lead.transactionType === 'buy' && lead.paymentMethod === 'credit' && lead.creditPreapproved === false) {
    contradictions.push('El crédito todavía no está preaprobado.');
  }
  return { completeness, rigidity, contradictions };
}

export function matchProperties(lead: LeadInput, properties: Property[]): MatchResult[] {
  const requestedCity = norm(lead.city);
  return properties
    .filter((property) => property.transactionType === lead.transactionType)
    .filter((property) => property.propertyType === lead.propertyType)
    .filter((property) => property.price <= lead.budgetMax * 1.15 && property.price >= lead.budgetMin * 0.75)
    .filter((property) => norm(property.city).includes(requestedCity) || requestedCity.includes(norm(property.city)))
    .map((property) => scoreProperty(lead, property))
    .filter((property) => property.matchScore >= 45)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);
}

function scoreProperty(lead: LeadInput, property: Property): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const gaps: string[] = [];

  if (property.propertyType === lead.propertyType) { score += 18; reasons.push('Tipo de inmueble compatible'); }
  else gaps.push('Tipo de inmueble distinto');

  if (norm(property.city).includes(norm(lead.city)) || norm(lead.city).includes(norm(property.city))) {
    score += 15; reasons.push('Ciudad compatible');
  } else gaps.push('Otra ciudad o municipio');

  if (!lead.neighborhoods.length || lead.neighborhoods.some((n) => norm(property.neighborhood).includes(norm(n)) || norm(n).includes(norm(property.neighborhood)))) {
    score += 12; reasons.push('Zona compatible');
  } else gaps.push('Fuera de las colonias preferidas');

  if (property.price >= lead.budgetMin && property.price <= lead.budgetMax) {
    score += 22; reasons.push('Dentro del presupuesto');
  } else if (property.price <= lead.budgetMax * 1.15 && property.price >= lead.budgetMin * 0.85) {
    score += 10; gaps.push('Precio cercano al rango');
  } else gaps.push('Precio fuera del rango');

  if (property.bedrooms >= lead.bedrooms) { score += 10; reasons.push('Cumple recámaras'); }
  else gaps.push(`Faltan ${lead.bedrooms - property.bedrooms} recámara(s)`);

  if (property.bathrooms >= lead.bathrooms) score += 5; else gaps.push('Menos baños de los solicitados');
  if (property.parking >= lead.parking) score += 4; else gaps.push('Menos estacionamientos');
  if (!lead.pool || property.pool) score += 4; else gaps.push('Sin alberca');
  if (!lead.garden || property.garden) score += 4; else gaps.push('Sin jardín');
  if (!lead.yard || property.yard) score += 3; else gaps.push('Sin patio');
  if (!lead.landAreaMin || property.landArea >= lead.landAreaMin) score += 2; else gaps.push('Terreno menor al solicitado');
  if (!lead.constructionAreaMin || property.constructionArea >= lead.constructionAreaMin) score += 2; else gaps.push('Construcción menor a la solicitada');

  return {
    ...property,
    matchScore: Math.min(100, score),
    reasons,
    gaps,
    availabilityLabel: 'Disponibilidad por confirmar',
  };
}

export function deterministicAnalysis(lead: LeadInput, matches: MatchResult[]): AiAnalysis {
  const metrics = calculateLeadMetrics(lead);
  const pressurePoints: string[] = [...metrics.contradictions];
  if (lead.neighborhoods.length === 3) pressurePoints.push('La búsqueda está limitada a tres zonas concretas.');
  if (lead.essentialFeatures.length >= 4) pressurePoints.push('Hay varias características clasificadas como indispensables.');
  if (lead.pool) pressurePoints.push('La alberca reduce de forma importante el inventario compatible.');
  if (lead.bedrooms >= 4) pressurePoints.push('Cuatro o más recámaras son menos frecuentes en rangos de entrada.');

  const suggestions = buildAlternatives(lead, matches);
  const viability: AiAnalysis['viability'] = matches.length >= 3 ? 'high' : matches.length > 0 ? 'medium' : metrics.completeness < 80 ? 'insufficient_data' : 'low';
  const headline = matches.length
    ? `Se encontraron ${matches.length} opción(es) con compatibilidad parcial o alta.`
    : 'No encontramos una coincidencia suficiente en las fuentes configuradas.';
  const explanation = matches.length
    ? 'Las opciones se ordenaron comparando presupuesto, zona, tipo de inmueble, espacios y características. La disponibilidad y condiciones deben confirmarse con el anunciante o asesor.'
    : 'La combinación solicitada no aparece en el catálogo consultado. Esto no demuestra que sea imposible, pero sí indica que conviene flexibilizar una o más variables o ampliar las fuentes.';

  return {
    viability,
    headline,
    explanation,
    pressurePoints: pressurePoints.slice(0, 6),
    suggestions,
    advisorSummary: `${lead.transactionType === 'rent' ? 'Renta' : 'Compra'} de ${lead.propertyType} en ${lead.city}; presupuesto máximo ${lead.budgetMax} MXN; ${lead.bedrooms} recámaras; zonas: ${lead.neighborhoods.join(', ') || 'abierta'}.`,
  };
}

export function buildAlternatives(lead: LeadInput, matches: MatchResult[]): string[] {
  const suggestions: string[] = [];
  if (!matches.length || matches.every((m) => m.price > lead.budgetMax)) suggestions.push('Aumentar el presupuesto máximo entre 10% y 15%.');
  if (lead.neighborhoods.length) suggestions.push('Ampliar la búsqueda a colonias cercanas del mismo municipio.');
  if (lead.bedrooms >= 4) suggestions.push(`Revisar opciones de ${lead.bedrooms - 1} recámaras con estudio o área adaptable.`);
  if (lead.pool) suggestions.push('Cambiar alberca privada por alberca común o casa club.');
  if (lead.propertyType === 'house') suggestions.push('Comparar departamentos amplios en la misma zona.');
  if (lead.transactionType === 'buy') suggestions.push('Considerar preventa o una zona en desarrollo con mejor relación precio-metraje.');
  return [...new Set(suggestions)].slice(0, 6).concat(suggestions.length ? [] : ['Ampliar el rango de ubicación o presupuesto.']);
}

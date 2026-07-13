import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { config } from './config.js';
import { aiAnalysisSchema, type AiAnalysis, type LeadInput, type MatchResult } from './schemas.js';
import { deterministicAnalysis } from './scoring.js';

export async function analyzeWithAi(lead: LeadInput, matches: MatchResult[]): Promise<{ analysis: AiAnalysis; source: 'openai' | 'deterministic' }> {
  const fallback = deterministicAnalysis(lead, matches);
  if (!config.openaiApiKey) return { analysis: fallback, source: 'deterministic' };

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const sanitizedLead = {
    transactionType: lead.transactionType,
    propertyType: lead.propertyType,
    city: lead.city,
    neighborhoods: lead.neighborhoods,
    budgetMin: lead.budgetMin,
    budgetMax: lead.budgetMax,
    bedrooms: lead.bedrooms,
    bathrooms: lead.bathrooms,
    parking: lead.parking,
    pool: lead.pool,
    garden: lead.garden,
    yard: lead.yard,
    landAreaMin: lead.landAreaMin,
    constructionAreaMin: lead.constructionAreaMin,
    essentials: lead.essentialFeatures,
    matchCount: matches.length,
    bestMatchScores: matches.slice(0, 5).map((m) => m.matchScore),
  };

  try {
    const response = await client.responses.parse({
      model: config.openaiModel,
      store: false,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'system',
          content: 'Eres un analista inmobiliario prudente. Explica la viabilidad de una solicitud usando solo los datos suministrados. No inventes inventario, precios, disponibilidad, normas ni estadísticas. Distingue claramente entre ausencia de coincidencias en el catálogo y ausencia total en el mercado. Responde en español claro y profesional.',
        },
        { role: 'user', content: JSON.stringify(sanitizedLead) },
      ],
      text: { format: zodTextFormat(aiAnalysisSchema, 'real_estate_lead_analysis') },
    });
    return { analysis: response.output_parsed ?? fallback, source: response.output_parsed ? 'openai' : 'deterministic' };
  } catch (error) {
    console.error('OpenAI analysis failed; deterministic fallback used.', error instanceof Error ? error.message : 'unknown');
    return { analysis: fallback, source: 'deterministic' };
  }
}

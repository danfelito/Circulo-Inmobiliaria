import { z } from 'zod';

export const transactionTypeSchema = z.enum(['rent', 'buy']);
export const propertyTypeSchema = z.enum(['house', 'apartment', 'land', 'retail', 'office', 'warehouse', 'ranch']);

const criteriaObject = z.object({
  transactionType: transactionTypeSchema, tenants: z.coerce.number().int().min(1).max(30).optional(), hasPets: z.boolean().default(false), petCount: z.number().int().min(0).max(30).default(0), petType: z.string().trim().max(120).default(''), hasGuarantor: z.boolean().default(false), hasLegalPolicy: z.boolean().default(false), petDetails: z.string().trim().max(300).optional().default(''), moveInDate: z.string().max(30).optional().default(''), contractMonths: z.coerce.number().int().min(1).max(60).optional(), propertyType: propertyTypeSchema, furnished: z.enum(['furnished', 'semi', 'unfurnished', 'indifferent']).optional(), floors: z.enum(['1', '2', '3', 'indifferent']).default('indifferent'), bedrooms: z.coerce.number().int().min(0).max(15).default(0), bathrooms: z.coerce.number().min(0).max(15).default(0), parking: z.coerce.number().int().min(0).max(10).default(0), yard: z.boolean().default(false), garden: z.boolean().default(false), pool: z.boolean().default(false), amenities: z.array(z.string().trim().min(1).max(80)).max(20).default([]), invoiceRequired: z.boolean().optional(), delivery: z.enum(['presale', 'immediate', 'indifferent']).optional(), paymentMethod: z.enum(['credit', 'cash', 'mixed']).optional(), creditPreapproved: z.boolean().optional(), creditAmount: z.coerce.number().min(0).max(1_000_000_000).optional(), landAreaMin: z.coerce.number().min(0).max(1_000_000).optional(), constructionAreaMin: z.coerce.number().min(0).max(1_000_000).optional(), city: z.string().trim().min(2).max(120), neighborhoods: z.array(z.string().trim().min(1).max(120)).max(3).default([]), budgetMin: z.coerce.number().min(0).max(1_000_000_000).default(0), budgetMax: z.coerce.number().positive().max(1_000_000_000), essentialFeatures: z.array(z.string().trim().min(1).max(160)).max(20).default([]), desirableFeatures: z.array(z.string().trim().min(1).max(160)).max(20).default([]), comments: z.string().trim().max(1500).optional().default(''), website: z.string().max(0).optional().default(''),
});

function normalizeRentalInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const value = { ...input } as Record<string, unknown>;
  if (value.transactionType === 'buy') {
    return { ...value, hasPets: false, petCount: 0, petType: '', petDetails: '', hasGuarantor: false, hasLegalPolicy: false };
  }
  if (value.hasPets !== true) {
    value.petCount = 0;
    value.petType = '';
    value.petDetails = '';
  }
  // Legacy guarantees are input-only. An explicit boolean, including a
  // deselection, takes precedence over the old mutually exclusive selector.
  if (value.hasGuarantor === undefined) value.hasGuarantor = value.guarantee === 'guarantor';
  if (value.hasLegalPolicy === undefined) value.hasLegalPolicy = value.guarantee === 'legal_policy';
  return value;
}

function validateCriteria(lead: z.infer<typeof criteriaObject>, ctx: z.RefinementCtx) {
  if (lead.budgetMax < lead.budgetMin) ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'El presupuesto máximo debe ser mayor o igual al mínimo.' });
  if (lead.transactionType === 'rent' && lead.hasPets) {
    if (lead.petCount < 1) ctx.addIssue({ code: 'custom', path: ['petCount'], message: 'Indica cuántas mascotas tienes.' });
    if (!lead.petType.trim()) ctx.addIssue({ code: 'custom', path: ['petType'], message: 'Indica qué tipo de mascota tienes.' });
  }
}

export const criteriaSchema = z.preprocess(normalizeRentalInput, criteriaObject.superRefine(validateCriteria));

export const contactSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(180).or(z.literal('')).default(''),
  phone: z.string().trim().min(8).max(30).refine(value => /^\+?[\d ()-]+$/.test(value) && value.replace(/\D/g, '').length >= 8 && value.replace(/\D/g, '').length <= 15, 'Escribe un teléfono válido.'),
  privacyAccepted: z.literal(true), contactAccepted: z.literal(true), website: z.string().max(0).default(''),
});
export const leadSchema = z.preprocess(normalizeRentalInput, criteriaObject.extend(contactSchema.shape).superRefine(validateCriteria));

export const aiAnalysisSchema = z.object({ viability: z.enum(['high', 'medium', 'low', 'insufficient_data']), headline: z.string().min(5).max(180), explanation: z.string().min(20).max(900), pressurePoints: z.array(z.string().min(3).max(180)).max(6), suggestions: z.array(z.string().min(3).max(180)).min(1).max(6), advisorSummary: z.string().min(20).max(1200) });
export const providerSchema = z.object({ id: z.string().regex(/^source-(10|[1-9])$/), name: z.string().trim().min(1).max(120), baseUrl: z.string().trim().url().or(z.literal('')), enabled: z.boolean() });
export const providersSchema = z.array(providerSchema).length(10);
export type SearchCriteria = z.infer<typeof criteriaSchema>;
export type LeadInput = z.infer<typeof leadSchema>; export type AiAnalysis = z.infer<typeof aiAnalysisSchema>; export type ProviderInput = z.infer<typeof providerSchema>;
export type Property = { id: string; title: string; transactionType: 'rent' | 'buy'; propertyType: z.infer<typeof propertyTypeSchema>; city: string; neighborhood: string; locationText?: string; price: number; bedrooms: number; bathrooms: number; parking: number; landArea: number; constructionArea: number; floors: number; furnished?: 'furnished' | 'semi' | 'unfurnished'; yard: boolean; garden: boolean; pool: boolean; amenities: string[]; sourceName: string; sourceUrl: string; verifiedAt?: string; verifiedFields?: string[]; imageUrl?: string; demo: boolean; };
export type MatchResult = Property & { matchScore: number; reasons: string[]; gaps: string[]; availabilityLabel: string; matchType: 'exact' | 'alternative'; adjustments: ('budget' | 'location' | 'features')[]; };
export type SearchAdjustment = { id: string; label: string; explanation: string; propertyIds: string[]; changes: { budgetMax?: number; budgetMin?: number; city?: string; neighborhoods?: string[] } };
export type SearchSnapshot = { searchId: string; createdAt: string; criteria: SearchCriteria; analysis: AiAnalysis; matches: MatchResult[]; alternatives: MatchResult[]; adjustments: SearchAdjustment[]; sourcesConsulted: number; warnings: string[] };

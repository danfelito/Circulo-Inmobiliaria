import { z } from 'zod';
import type { LeadForm } from './types';

export const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
export const labelProperty = (value: string) => ({ house: 'Casa', apartment: 'Departamento', land: 'Terreno', retail: 'Local', office: 'Oficina', warehouse: 'Bodega', ranch: 'Rancho' }[value] || value);
export const draftKey = 'circulo-search-criteria-v2';
export const idempotencyStorageKey = 'circulo-search-idempotency-v3';

const formObject = z.object({
  transactionType: z.enum(['rent', 'buy']),
  tenants: z.coerce.number().optional(), hasPets: z.boolean(), petCount: z.number().int().min(1).max(30).optional(), petType: z.string().trim().max(120), hasGuarantor: z.boolean(), hasLegalPolicy: z.boolean(), moveInDate: z.string(), contractMonths: z.coerce.number().optional(),
  propertyType: z.enum(['house', 'apartment', 'land', 'retail', 'office', 'warehouse', 'ranch']), furnished: z.enum(['furnished', 'semi', 'unfurnished', 'indifferent']).optional(), floors: z.enum(['1', '2', '3', 'indifferent']),
  bedrooms: z.coerce.number().min(0), bathrooms: z.coerce.number().min(0), parking: z.coerce.number().min(0), yard: z.boolean(), garden: z.boolean(), pool: z.boolean(), amenities: z.array(z.string()), invoiceRequired: z.boolean().optional(),
  delivery: z.enum(['presale', 'immediate', 'indifferent']).optional(), paymentMethod: z.enum(['credit', 'cash', 'mixed']).optional(), creditPreapproved: z.boolean().optional(), creditAmount: z.coerce.number().optional(), landAreaMin: z.coerce.number().optional(), constructionAreaMin: z.coerce.number().optional(), city: z.string().min(2, 'Indica la ciudad o municipio.'),
  neighborhood1: z.string(), neighborhood2: z.string(), neighborhood3: z.string(), budgetMin: z.coerce.number().min(0), budgetMax: z.coerce.number().positive('Indica el presupuesto máximo.'), essentialText: z.string(), desirableText: z.string(), comments: z.string(), website: z.string().max(0),
}).superRefine((data, ctx) => {
  if (data.budgetMax < data.budgetMin) ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'El máximo debe ser mayor o igual al mínimo.' });
  if (data.transactionType === 'rent' && data.hasPets) {
    if (data.petCount === undefined) ctx.addIssue({ code: 'custom', path: ['petCount'], message: 'Indica cuántas mascotas tienes.' });
    if (!data.petType.trim()) ctx.addIssue({ code: 'custom', path: ['petType'], message: 'Indica qué tipo de mascota tienes.' });
  }
});

export function normalizeRentalFields(values: LeadForm): LeadForm {
  if (values.transactionType === 'buy') return { ...values, hasPets: false, petCount: undefined, petType: '', hasGuarantor: false, hasLegalPolicy: false };
  if (!values.hasPets) return { ...values, petCount: undefined, petType: '' };
  return values;
}

export const schema = z.custom<LeadForm>(value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)).transform((value): z.input<typeof formObject> => normalizeRentalFields(value)).pipe(formObject);

export const defaults: LeadForm = { transactionType: 'rent', tenants: 1, hasPets: false, petCount: undefined, petType: '', hasGuarantor: false, hasLegalPolicy: false, moveInDate: '', contractMonths: 12, propertyType: 'house', furnished: 'indifferent', floors: 'indifferent', bedrooms: 2, bathrooms: 1, parking: 1, yard: false, garden: false, pool: false, amenities: [], invoiceRequired: false, delivery: 'indifferent', paymentMethod: 'credit', creditPreapproved: false, creditAmount: 0, landAreaMin: 0, constructionAreaMin: 0, city: '', neighborhood1: '', neighborhood2: '', neighborhood3: '', budgetMin: 0, budgetMax: 0, essentialText: '', desirableText: '', comments: '', website: '' };

export function restoreDraft(value: unknown): LeadForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults };
  const saved = value as Record<string, unknown>;
  // Restore only criteria; old contact data and the retired guarantee selector stay out.
  const criteria = Object.fromEntries(Object.keys(defaults).filter(key => saved[key] !== undefined).map(key => [key, saved[key]]));
  const restored = { ...defaults, ...criteria } as LeadForm;
  restored.transactionType = saved.transactionType === 'buy' ? 'buy' : 'rent';
  restored.hasPets = saved.hasPets === true;
  restored.hasGuarantor = saved.hasGuarantor === undefined ? saved.guarantee === 'guarantor' : saved.hasGuarantor === true;
  restored.hasLegalPolicy = saved.hasLegalPolicy === undefined ? saved.guarantee === 'legal_policy' : saved.hasLegalPolicy === true;
  restored.petType = typeof saved.petType === 'string' && saved.petType.trim() ? saved.petType : typeof saved.petDetails === 'string' ? saved.petDetails : '';
  restored.petCount = typeof saved.petCount === 'number' && saved.petCount > 0 ? saved.petCount : undefined;
  return normalizeRentalFields(restored);
}

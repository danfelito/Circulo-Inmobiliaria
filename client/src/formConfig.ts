import { z } from 'zod';
import type { LeadForm } from './types';

export const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
export const draftKey = 'circulo-real-estate-draft-v1';
export const idempotencyStorageKey = 'circulo-real-estate-idempotency-v1';

export const schema = z.object({
  transactionType: z.enum(['rent', 'buy']), fullName: z.string().min(3, 'Escribe tu nombre completo.'), email: z.string().email('Escribe un correo válido.'), phone: z.string().min(8, 'Escribe un teléfono o WhatsApp válido.'),
  tenants: z.coerce.number().optional(), hasPets: z.boolean(), petDetails: z.string(), moveInDate: z.string(), contractMonths: z.coerce.number().optional(),
  propertyType: z.enum(['house', 'apartment', 'land', 'retail', 'office', 'warehouse', 'ranch']), furnished: z.enum(['furnished', 'semi', 'unfurnished', 'indifferent']).optional(), floors: z.enum(['1', '2', '3', 'indifferent']),
  bedrooms: z.coerce.number().min(0), bathrooms: z.coerce.number().min(0), parking: z.coerce.number().min(0), yard: z.boolean(), garden: z.boolean(), pool: z.boolean(), amenities: z.array(z.string()), invoiceRequired: z.boolean().optional(), guarantee: z.enum(['guarantor', 'legal_policy', 'deposit', 'advice']).optional(),
  delivery: z.enum(['presale', 'immediate', 'indifferent']).optional(), paymentMethod: z.enum(['credit', 'cash', 'mixed']).optional(), creditPreapproved: z.boolean().optional(), creditAmount: z.coerce.number().optional(), landAreaMin: z.coerce.number().optional(), constructionAreaMin: z.coerce.number().optional(), city: z.string().min(2, 'Indica la ciudad o municipio.'),
  neighborhood1: z.string(), neighborhood2: z.string(), neighborhood3: z.string(), budgetMin: z.coerce.number().min(0), budgetMax: z.coerce.number().positive('Indica el presupuesto máximo.'), essentialText: z.string(), desirableText: z.string(), comments: z.string(), privacyAccepted: z.boolean().refine(Boolean, 'Debes aceptar el Aviso de Privacidad y los Términos.'), contactAccepted: z.boolean().refine(Boolean, 'Debes autorizar el contacto del asesor.'), website: z.string().max(0),
}).superRefine((data, ctx) => {
  if (data.budgetMax < data.budgetMin) ctx.addIssue({ code: 'custom', path: ['budgetMax'], message: 'El máximo debe ser mayor o igual al mínimo.' });
  if (data.transactionType === 'rent' && !data.moveInDate) ctx.addIssue({ code: 'custom', path: ['moveInDate'], message: 'Indica la fecha de inicio.' });
  if (data.transactionType === 'rent' && !data.contractMonths) ctx.addIssue({ code: 'custom', path: ['contractMonths'], message: 'Indica la duración.' });
  if (data.transactionType === 'buy' && !data.paymentMethod) ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Indica la forma de pago.' });
  if (data.hasPets && !data.petDetails.trim()) ctx.addIssue({ code: 'custom', path: ['petDetails'], message: 'Describe tus mascotas.' });
});

export const defaults: LeadForm = { transactionType: 'rent', fullName: '', email: '', phone: '', tenants: 1, hasPets: false, petDetails: '', moveInDate: '', contractMonths: 12, propertyType: 'house', furnished: 'indifferent', floors: 'indifferent', bedrooms: 2, bathrooms: 1, parking: 1, yard: false, garden: false, pool: false, amenities: [], invoiceRequired: false, guarantee: 'advice', delivery: 'indifferent', paymentMethod: 'credit', creditPreapproved: false, creditAmount: 0, landAreaMin: 0, constructionAreaMin: 0, city: '', neighborhood1: '', neighborhood2: '', neighborhood3: '', budgetMin: 0, budgetMax: 0, essentialText: '', desirableText: '', comments: '', privacyAccepted: false, contactAccepted: false, website: '' };
import { describe, expect, it } from 'vitest';
import { criteriaSchema, leadSchema } from './schemas.js';

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
  it('comparte valores por defecto y normalización entre consulta y contacto', () => {
    const parsed = leadSchema.parse(common);
    expect(criteriaSchema.parse(parsed)).toEqual(criteriaSchema.parse(common));
    expect(parsed).toMatchObject({ hasPets: false, petCount: 0, petType: '', hasGuarantor: false, hasLegalPolicy: false });
    expect(parsed).not.toHaveProperty('guarantee');
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])('conserva fiador %s y póliza %s independientes', (hasGuarantor, hasLegalPolicy) => {
    const input = { ...common, hasGuarantor, hasLegalPolicy };
    expect(criteriaSchema.parse(input)).toMatchObject({ hasGuarantor, hasLegalPolicy });
    expect(leadSchema.parse(input)).toMatchObject({ hasGuarantor, hasLegalPolicy });
  });
  it.each(['guarantor', 'legal_policy', 'deposit', 'advice'])('convierte garantía antigua %s sin emitir el campo antiguo', guarantee => {
    for (const schema of [criteriaSchema, leadSchema]) {
      const parsed = schema.parse({ ...common, guarantee });
      expect(parsed.hasGuarantor).toBe(guarantee === 'guarantor');
      expect(parsed.hasLegalPolicy).toBe(guarantee === 'legal_policy');
      expect(parsed).not.toHaveProperty('guarantee');
    }
  });
  it('una deselección explícita prevalece sobre la garantía antigua', () => {
    expect(criteriaSchema.parse({ ...common, guarantee: 'guarantor', hasGuarantor: false, hasLegalPolicy: true })).toMatchObject({ hasGuarantor: false, hasLegalPolicy: true });
    expect(leadSchema.parse({ ...common, guarantee: 'legal_policy', hasGuarantor: true, hasLegalPolicy: false })).toMatchObject({ hasGuarantor: true, hasLegalPolicy: false });
  });
  it('recorta el tipo sin alterar cantidad ni otros filtros', () => {
    const parsed = criteriaSchema.parse({ ...common, hasPets: true, petCount: 2, petType: '  Perro y gato  ', essentialFeatures: ['Estudio'], invoiceRequired: true });
    expect(parsed).toMatchObject({ hasPets: true, petCount: 2, petType: 'Perro y gato', essentialFeatures: ['Estudio'], invoiceRequired: true });
    expect(leadSchema.parse({ ...common, ...parsed }).petCount).toBe(2);
  });
  it.each([undefined, 0, -1, 1.5, 31, Number.NaN, Number.POSITIVE_INFINITY, '2', true, false, null])('rechaza cantidad inválida %s en consulta y contacto', petCount => {
    const input = { ...common, hasPets: true, petCount, petType: 'Perro' };
    for (const schema of [criteriaSchema, leadSchema]) {
      const parsed = schema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues.some(issue => issue.path[0] === 'petCount')).toBe(true);
    }
  });
  it.each(['', '   ', 'p'.repeat(121)])('rechaza tipo vacío o demasiado largo', petType => {
    const input = { ...common, hasPets: true, petCount: 1, petType };
    expect(criteriaSchema.safeParse(input).success).toBe(false);
    expect(leadSchema.safeParse(input).success).toBe(false);
  });
  it('limpia datos ocultos al deseleccionar mascotas antes de validarlos', () => {
    const input = { ...common, hasPets: false, petCount: -10, petType: { stale: true }, petDetails: null, hasGuarantor: true, hasLegalPolicy: false };
    for (const schema of [criteriaSchema, leadSchema]) {
      expect(schema.parse(input)).toMatchObject({ hasPets: false, petCount: 0, petType: '', petDetails: '', hasGuarantor: true, hasLegalPolicy: false });
    }
  });
  it('limpia todos los controles exclusivos de renta en compra antes de validar', () => {
    const input = { ...common, transactionType: 'buy', hasPets: true, petCount: -5, petType: { stale: true }, petDetails: null, hasGuarantor: 'stale', hasLegalPolicy: null, guarantee: 'legal_policy' };
    for (const schema of [criteriaSchema, leadSchema]) {
      const parsed = schema.parse(input);
      expect(parsed).toMatchObject({ transactionType: 'buy', hasPets: false, petCount: 0, petType: '', petDetails: '', hasGuarantor: false, hasLegalPolicy: false });
      expect(parsed).not.toHaveProperty('guarantee');
    }
  });
  it('exige booleanos reales para fiador y póliza en renta', () => {
    expect(criteriaSchema.safeParse({ ...common, hasGuarantor: 'false' }).success).toBe(false);
    expect(leadSchema.safeParse({ ...common, hasLegalPolicy: null }).success).toBe(false);
  });
  it('no infiere cantidad ni tipo desde la descripción antigua', () => {
    const input = { ...common, hasPets: true, petDetails: '2 perros medianos' };
    expect(criteriaSchema.safeParse(input).success).toBe(false);
    expect(leadSchema.safeParse(input).success).toBe(false);
  });
});

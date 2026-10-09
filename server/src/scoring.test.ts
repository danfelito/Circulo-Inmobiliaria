import { describe, expect, it } from 'vitest';
import { criteria, property } from './testFixtures.js';
import { deterministicAnalysis, rankProperties } from './scoring.js';

describe('resultados y alternativas basados en anuncios', () => {
  it('clasifica una coincidencia solo cuando cumple los criterios comparables', () => {
    const result = rankProperties(criteria, [property]);
    expect(result.matches.map(item => item.id)).toEqual(['real-1']);
    expect(result.alternatives).toEqual([]);
  });
  it('separa el precio fuera del presupuesto y propone el precio observado', () => {
    const result = rankProperties(criteria, [{ ...property, price: 2_870_000 }]);
    expect(result.matches).toEqual([]);
    expect(result.alternatives[0].gaps.join(' ')).toContain('370,000');
    expect(result.adjustments[0].changes).toEqual({ budgetMax: 2_870_000 });
  });
  it('no usa un dato ausente como cumplimiento', () => {
    const result = rankProperties(criteria, [{ ...property, bedrooms: 0, verifiedFields: ['bathrooms', 'parking'] }]);
    expect(result.matches).toEqual([]);
    expect(result.alternatives[0].gaps).toContain('Recámaras: dato por confirmar');
    expect(result.adjustments).toEqual([]);
  });
  it('una colonia vacía no coincide con cualquier zona', () => {
    const result = rankProperties(criteria, [{ ...property, neighborhood: '' }]);
    expect(result.matches).toEqual([]);
    expect(result.adjustments).toEqual([]);
  });
  it('propone una colonia concreta sin subir el presupuesto ni quitar indispensables', () => {
    const result = rankProperties(criteria, [{ ...property, neighborhood: 'Flores Magón' }]);
    expect(result.adjustments[0].changes).toEqual({ city: 'Boca del Río', neighborhoods: ['Flores Magón'] });
    expect(result.adjustments[0].explanation).toContain('dentro de tu presupuesto');
  });
  it('no confunde localidades por una coincidencia parcial de texto', () => {
    const result = rankProperties({ ...criteria, city: 'Veracruz', neighborhoods: [] }, [{ ...property, city: 'Veracruz Viejo' }]);
    expect(result.matches).toEqual([]);
  });
  it('no recomienda un precio si también faltan características indispensables', () => {
    const result = rankProperties(criteria, [{ ...property, price: 3_000_000, bedrooms: 2 }]);
    expect(result.adjustments).toEqual([]);
  });
  it('no induce a subir el presupuesto cuando ya hay una coincidencia dentro del rango', () => {
    const result = rankProperties(criteria, [property, { ...property, id: 'expensive', price: 32_000_000 }]);
    expect(result.matches).toHaveLength(1);
    expect(result.adjustments.some(item => item.id === 'budget')).toBe(false);
    expect(result.alternatives.some(item => item.id === 'expensive')).toBe(false);
  });
  it('excluye demostraciones y otro tipo de inmueble', () => {
    const result = rankProperties(criteria, [{ ...property, demo: true }, { ...property, propertyType: 'apartment' }]);
    expect(result.matches).toEqual([]);
    expect(result.alternatives).toEqual([]);
  });
  it('trata un indispensable sin evidencia como pendiente de confirmar', () => {
    const result = rankProperties({ ...criteria, essentialFeatures: ['acceso sin escaleras'] }, [property]);
    expect(result.matches).toEqual([]);
    expect(result.alternatives[0].gaps.join(' ')).toContain('acceso sin escaleras');
  });
  it('no presenta una característica negada como indispensable cumplido', () => {
    const result = rankProperties({ ...criteria, essentialFeatures: ['estudio'] }, [{ ...property, amenities: ['Sin estudio'] }]);
    expect(result.matches).toEqual([]);
  });
  it('sin inventario no inventa un incremento de precio ni una zona disponible', () => {
    const analysis = deterministicAnalysis(criteria, []);
    expect(analysis.viability).toBe('insufficient_data');
    expect(analysis.suggestions.join(' ')).not.toMatch(/15%|10%/);
    expect(analysis.explanation).toContain('únicamente las fuentes');
  });
});

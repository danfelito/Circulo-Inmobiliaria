import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { submitSearch } from './api';
import type { LeadForm, SearchAdjustment, SearchResponse } from './types';
import { defaults, draftKey, schema } from './formConfig';
import { Results } from './Results';
import { StepLocation, StepMode, StepProperty, StepReview } from './Steps';

const storage = { read: () => { try { return JSON.parse(sessionStorage.getItem(draftKey) || 'null') as LeadForm | null; } catch { return null; } }, save: (value: unknown) => { try { sessionStorage.setItem(draftKey, JSON.stringify(value)); } catch { /* Storage is optional. */ } } };
export function Wizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [searchKey, setSearchKey] = useState(() => crypto.randomUUID());
  const saved = useMemo(() => storage.read(), []);
  const form = useForm<LeadForm>({ resolver: zodResolver(schema) as Resolver<LeadForm>, defaultValues: saved || defaults, mode: 'onBlur' });
  const type = form.watch('transactionType'), propertyType = form.watch('propertyType'), hasPets = form.watch('hasPets'), payment = form.watch('paymentMethod');

  useEffect(() => {
    // Retire the old draft containing contact data. New drafts contain criteria only.
    try { localStorage.removeItem('circulo-real-estate-draft-v1'); localStorage.removeItem('circulo-real-estate-idempotency-v2'); } catch { /* Storage is optional. */ }
    const subscription = form.watch(value => storage.save(value));
    return () => subscription.unsubscribe();
  }, [form]);
  useEffect(() => {
    if (!['house', 'apartment'].includes(propertyType)) { form.setValue('bedrooms', 0); form.setValue('bathrooms', 0); }
    if (propertyType === 'land') { form.setValue('parking', 0); form.setValue('floors', 'indifferent'); form.setValue('yard', false); form.setValue('garden', false); form.setValue('pool', false); form.setValue('constructionAreaMin', 0); }
  }, [form, propertyType]);

  const next = async () => {
    const groups: (keyof LeadForm)[][] = [[], ['propertyType', 'bedrooms', 'bathrooms', 'parking', 'landAreaMin', 'constructionAreaMin', 'petDetails', 'tenants', 'contractMonths', 'creditAmount'], ['city', 'budgetMin', 'budgetMax'], []];
    if (step === 0 || await form.trigger(groups[step])) { setStep(current => Math.min(3, current + 1)); setSubmitError(''); document.querySelector('.wizard-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  const onSubmit = form.handleSubmit(async values => {
    setBusy(true); setSubmitError('');
    try { setResult(await submitSearch(values, searchKey)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (error) { setSubmitError(error instanceof Error ? error.message : 'No fue posible consultar las fuentes. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }, () => { setSubmitError('Revisa los datos marcados antes de buscar.'); });
  const resetSearch = () => { setSearchKey(crypto.randomUUID()); setResult(null); setStep(2); setSubmitError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const newSearch = () => { storage.save(null); setSearchKey(crypto.randomUUID()); form.reset(defaults); setResult(null); setStep(0); setSubmitError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const applyAdjustment = (adjustment: SearchAdjustment) => {
    const changes = adjustment.changes;
    if (changes.budgetMax !== undefined) form.setValue('budgetMax', changes.budgetMax);
    if (changes.budgetMin !== undefined) form.setValue('budgetMin', changes.budgetMin);
    if (changes.city) form.setValue('city', changes.city);
    if (changes.neighborhoods) { form.setValue('neighborhood1', changes.neighborhoods[0] || ''); form.setValue('neighborhood2', changes.neighborhoods[1] || ''); form.setValue('neighborhood3', changes.neighborhoods[2] || ''); }
    resetSearch();
  };
  if (result) return <Results result={result} onReconfigure={resetSearch} onNew={newSearch} onApply={applyAdjustment} />;

  return <div className="page-shell"><section className={'hero ' + (step ? 'hero-compact' : '')}><div><span className="eyebrow">Encuentra tu próxima propiedad</span><h1>Una búsqueda clara. Opciones para decidir mejor.</h1><p>Cuéntanos qué necesitas y cuánto quieres invertir. Compara anuncios encontrados en nuestras fuentes y descubre qué alternativas tienes.</p></div><div className="trust-card"><strong>Tú decides el siguiente paso</strong><p>Primero revisas los resultados. Después eliges las propiedades que te interesan y, si lo deseas, pides que un asesor te contacte con tu búsqueda ya preparada.</p><span className="trust-note">Sin datos de contacto para consultar opciones.</span></div></section>
    <section className="wizard-card" aria-busy={busy}><div className="progress-row"><span>Paso {step + 1} de 4</span><div className="progress" role="progressbar" aria-label="Avance de la búsqueda" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}><i style={{ width: ((step + 1) * 25) + '%' }} /></div></div><ol className="step-labels">{['Operación', 'Propiedad', 'Zona y presupuesto', 'Revisión'].map((label, index) => <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>{label}</li>)}</ol>
      {step === 0 && <StepMode value={type} onChange={value => { form.setValue('transactionType', value); setSearchKey(crypto.randomUUID()); }} />}
      {step === 1 && <StepProperty form={form} type={type} propertyType={propertyType} hasPets={hasPets} payment={payment} />}
      {step === 2 && <StepLocation form={form} type={type} />}
      {step === 3 && <StepReview form={form} type={type} />}
      {submitError && <div className="alert error" role="alert">{submitError}</div>}
      {busy && <div className="search-progress" role="status"><span className="loading-dot" /><div><strong>Estamos consultando las fuentes</strong><p>Comparamos precios, ubicación y características. Esto puede tardar un momento.</p></div></div>}
      <div className="wizard-actions">{step > 0 && <button type="button" className="button ghost" disabled={busy} onClick={() => setStep(current => current - 1)}>Volver</button>}{step < 3 ? <button type="button" className="button primary" onClick={next}>Continuar</button> : <button type="button" className="button primary" disabled={busy} onClick={onSubmit}>{busy ? 'Buscando opciones…' : 'Ver propiedades y alternativas'}</button>}</div>
    </section>
  </div>;
}

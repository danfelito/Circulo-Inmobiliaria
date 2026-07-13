import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { submitLead } from './api';
import type { LeadForm, SearchResponse } from './types';
import { defaults, draftKey, idempotencyStorageKey, schema } from './formConfig';
import { Results } from './Results';
import { StepContact, StepLocation, StepMode, StepProperty, StepReview } from './Steps';

export function Wizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || 'null') as LeadForm | null; } catch { return null; }
  }, []);
  const form = useForm<LeadForm>({ resolver: zodResolver(schema) as Resolver<LeadForm>, defaultValues: saved || defaults, mode: 'onBlur' });
  const type = form.watch('transactionType');
  const propertyType = form.watch('propertyType');
  const hasPets = form.watch('hasPets');
  const payment = form.watch('paymentMethod');

  useEffect(() => {
    const subscription = form.watch((value) => localStorage.setItem(draftKey, JSON.stringify(value)));
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (type === 'rent' && propertyType === 'land') form.setValue('propertyType', 'house');
  }, [form, propertyType, type]);

  const next = async () => {
    const groups: (keyof LeadForm)[][] = [
      [],
      ['fullName', 'email', 'phone'],
      type === 'rent' ? ['tenants', 'moveInDate', 'contractMonths', 'propertyType', 'bedrooms'] : ['paymentMethod', 'propertyType', 'bedrooms'],
      ['city', 'budgetMax'],
      ['privacyAccepted', 'contactAccepted'],
    ];
    if (step === 0 || await form.trigger(groups[step])) setStep((current) => Math.min(4, current + 1));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setBusy(true); setSubmitError('');
    try {
      let key = localStorage.getItem(idempotencyStorageKey);
      if (!key) { key = crypto.randomUUID(); localStorage.setItem(idempotencyStorageKey, key); }
      setResult(await submitLead(values, key));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible analizar la solicitud.');
    } finally { setBusy(false); }
  });

  const resetSearch = () => { localStorage.removeItem(idempotencyStorageKey); setResult(null); setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const newSearch = () => {
    localStorage.removeItem(draftKey); localStorage.removeItem(idempotencyStorageKey); form.reset(defaults); setResult(null); setStep(0);
  };
  const applySuggestion = (suggestion: string) => {
    const text = suggestion.toLowerCase();
    if (text.includes('presupuesto')) form.setValue('budgetMax', Math.round(form.getValues('budgetMax') * 1.15));
    if (text.includes('colonias')) { form.setValue('neighborhood1', ''); form.setValue('neighborhood2', ''); form.setValue('neighborhood3', ''); }
    if (text.includes('recámaras')) form.setValue('bedrooms', Math.max(0, form.getValues('bedrooms') - 1));
    if (text.includes('alberca')) form.setValue('pool', false);
    if (text.includes('departamentos')) form.setValue('propertyType', 'apartment');
    resetSearch();
  };

  if (result) return <Results result={result} onReconfigure={resetSearch} onNew={newSearch} onApply={applySuggestion} />;

  return <div className="page-shell">
    <section className="hero">
      <div><span className="eyebrow">Asesoría inmobiliaria guiada</span><h1>Encuentra opciones que realmente se ajusten al mercado.</h1>
      <p>Cuéntanos qué buscas. Compararemos tus criterios con las fuentes configuradas y te explicaremos dónde existen coincidencias o qué conviene ajustar.</p></div>
      <div className="trust-card"><strong>Un proceso claro, un solo canal</strong><p>Al utilizar el servicio decides trabajar coordinadamente con nuestro equipo y dar preferencia al acompañamiento profesional. Esto evita búsquedas redundantes, reduce confusiones y nos permite evaluar contigo la mejor inversión. No constituye exclusividad contractual.</p></div>
    </section>

    <section className="wizard-card">
      <div className="progress-row"><span>Paso {step + 1} de 5</span><div className="progress"><i style={{ width: `${(step + 1) * 20}%` }} /></div></div>
      {step === 0 && <StepMode value={type} onChange={(value) => form.setValue('transactionType', value)} />}
      {step === 1 && <StepContact form={form} />}
      {step === 2 && <StepProperty form={form} type={type} propertyType={propertyType} hasPets={hasPets} payment={payment} />}
      {step === 3 && <StepLocation form={form} type={type} />}
      {step === 4 && <StepReview form={form} type={type} />}
      {submitError && <div className="alert error" role="alert">{submitError}</div>}
      <div className="wizard-actions">
        {step > 0 && <button type="button" className="button ghost" onClick={() => setStep((current) => current - 1)}>Regresar</button>}
        {step < 4 ? <button type="button" className="button primary" onClick={next}>Continuar</button> : <button type="button" className="button primary" disabled={busy} onClick={onSubmit}>{busy ? 'Analizando fuentes y criterios…' : 'Buscar opciones'}</button>}
      </div>
    </section>
  </div>;
}

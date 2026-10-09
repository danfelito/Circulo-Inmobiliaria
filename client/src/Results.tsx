import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestAdvisorContact } from './api';
import { Field } from './FormParts';
import { labelProperty } from './formConfig';
import type { ConfirmationResponse, ContactForm, PropertyMatch, SearchAdjustment, SearchResponse } from './types';

const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const emptyContact: ContactForm = { fullName: '', email: '', phone: '', privacyAccepted: false, contactAccepted: false, website: '' };
const known = (property: PropertyMatch, field: string) => !property.verifiedFields || property.verifiedFields.includes(field);

function PropertyCard({ property, checked, locked, onToggle }: { property: PropertyMatch; checked: boolean; locked: boolean; onToggle: () => void }) {
  const residential = ['house', 'apartment'].includes(property.propertyType);
  return <article className={'property-card selectable ' + (checked ? 'selected' : '')}>
    {property.imageUrl && <img className="property-image" src={property.imageUrl} alt={property.title} loading="lazy" />}
    <div className="property-top"><span className={'match-tag ' + property.matchType}>{property.matchType === 'exact' ? 'Cumple tus criterios' : 'Alternativa para revisar'}</span><span className="demo-badge">{property.sourceName}</span></div>
    <h3>{property.title}</h3><p className="location">{[property.neighborhood, property.city].filter(Boolean).join(' · ')}</p>
    <strong className="price">{currency(property.price)}{property.transactionType === 'rent' && <small> / mes</small>}</strong>
    <div className="facts">{residential && <><span>{known(property, 'bedrooms') ? property.bedrooms + ' rec.' : 'Recámaras por confirmar'}</span><span>{known(property, 'bathrooms') ? property.bathrooms + ' baños' : 'Baños por confirmar'}</span></>}{known(property, 'parking') && property.parking > 0 && <span>{property.parking} est.</span>}{known(property, 'constructionArea') && property.constructionArea > 0 && <span>{property.constructionArea} m² const.</span>}{known(property, 'landArea') && property.landArea > 0 && <span>{property.landArea} m² terreno</span>}</div>
    {property.reasons.length > 0 && <ul className="reason-list">{property.reasons.slice(0, 4).map(reason => <li key={reason}>{reason}</li>)}</ul>}
    {property.gaps.length > 0 && <div className="property-differences"><strong>Qué cambia o falta confirmar</strong><ul>{property.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></div>}
    <p className="availability">{property.availabilityLabel}</p>
    <div className="property-card-actions"><a className="source-button" href={property.sourceUrl} target="_blank" rel="noreferrer">Ver anuncio ↗</a><label className="property-check"><input type="checkbox" checked={checked} disabled={locked} onChange={onToggle} aria-label={'Me interesa ' + property.title} /><span>{checked ? 'Seleccionada' : 'Me interesa'}</span></label></div>
  </article>;
}

export function Results({ result, onReconfigure, onNew, onApply }: { result: SearchResponse; onReconfigure: () => void; onNew: () => void; onApply: (adjustment: SearchAdjustment) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState<ContactForm>(emptyContact);
  const [confirmation, setConfirmation] = useState<ConfirmationResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const candidates = [...result.matches, ...result.alternatives];
  const selectedProperties = candidates.filter(property => selected.includes(property.id));
  const found = result.matches.length > 0;
  useEffect(() => {
    if (!showContact) return;
    let active = true;
    void fetch('/api/contact-status').then(response => response.ok ? response.json() : null).then(data => { if (active && data) setEmailAvailable(Boolean(data.available)); }).catch(() => undefined);
    return () => { active = false; };
  }, [showContact]);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const openContact = () => { setShowContact(true); setError(''); };
  const send = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const response = await requestAdvisorContact(result, selected, contact); setConfirmation(response); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'No fue posible enviar tu reporte. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  return <div className="page-shell results-page">
    <section className={'result-hero ' + (found ? 'success' : 'empty')}><span className="eyebrow">Tu resultado · {date(result.createdAt)}</span><h1>{found ? 'Hay opciones que coinciden con tu búsqueda.' : result.alternatives.length ? 'Hay alternativas. Veamos qué cambia.' : 'Aún no encontramos una coincidencia verificable.'}</h1><p>{result.analysis.explanation}</p><div className="metrics"><span><b>{result.matchCount}</b> {result.matchCount === 1 ? 'coincidencia' : 'coincidencias'}</span><span><b>{result.alternativeCount}</b> {result.alternativeCount === 1 ? 'alternativa' : 'alternativas'}</span><span><b>{result.sourcesConsulted}</b> {result.sourcesConsulted === 1 ? 'fuente consultada' : 'fuentes consultadas'}</span></div></section>
    <section className="search-summary"><div><span className="section-kicker">Lo que estás buscando</span><p><strong>{result.criteria.transactionType === 'rent' ? 'Renta' : 'Compra'} de {labelProperty(result.criteria.propertyType).toLowerCase()}</strong> · {result.criteria.city}{result.criteria.neighborhoods.length ? ' · ' + result.criteria.neighborhoods.join(', ') : ''}<br />{currency(result.criteria.budgetMin)} a {currency(result.criteria.budgetMax)}{result.criteria.transactionType === 'rent' ? ' mensuales' : ''}</p></div><button className="button ghost" onClick={onReconfigure}>Ajustar mi búsqueda</button></section>
    {result.warnings.length > 0 && <div className="coverage-notice" role="status"><strong>La consulta tiene cobertura parcial</strong><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}

    {found && <section className="property-selection"><div className="section-heading"><div><span className="section-kicker">Coincidencias</span><h2>Estas opciones cumplen tus criterios publicados</h2><p>Abre el anuncio para conocer sus detalles y marca las propiedades que te interesen.</p></div></div><div className="property-grid">{result.matches.map(property => <PropertyCard key={property.id} property={property} checked={selected.includes(property.id)} locked={busy || Boolean(confirmation?.confirmed)} onToggle={() => toggle(property.id)} />)}</div></section>}
    {result.alternatives.length > 0 && <section className="property-selection"><div className="section-heading"><div><span className="section-kicker">Alternativas</span><h2>{found ? 'También puedes comparar estas opciones' : 'Opciones con otro precio, zona o características'}</h2><p>Cada ficha explica las diferencias y los datos por confirmar. También puedes seleccionarlas para comentarlas con el asesor.</p></div></div><div className="property-grid">{result.alternatives.map(property => <PropertyCard key={property.id} property={property} checked={selected.includes(property.id)} locked={busy || Boolean(confirmation?.confirmed)} onToggle={() => toggle(property.id)} />)}</div></section>}
    {result.adjustments.length > 0 && <section className="alternatives"><div><span className="section-kicker">Decide con información</span><h2>Ajustes respaldados por anuncios</h2><p className="muted">El cambio se aplicará al formulario para que lo revises antes de volver a buscar.</p></div><div className="alternative-list">{result.adjustments.map(adjustment => <button key={adjustment.id} onClick={() => onApply(adjustment)}><span><strong>{adjustment.label}</strong><small>{adjustment.explanation}</small></span><b>Revisar →</b></button>)}</div></section>}
    {!candidates.length && <section className="no-results"><span className="section-kicker">Podemos seguir buscando</span><h2>Tu búsqueda puede necesitar otras fuentes</h2><p>Con los anuncios consultados no podemos recomendar un precio o una zona diferente de forma confiable. Puedes cambiar tus criterios o pedir al asesor que amplíe la búsqueda.</p><button className="button ghost" onClick={onReconfigure}>Cambiar mis criterios</button></section>}

    {!confirmation?.confirmed && <section className="contact-intro"><div><span className="section-kicker">El siguiente paso lo eliges tú</span><h2>¿Quieres que un asesor te contacte?</h2><p>{selected.length ? 'Tu reporte incluirá ' + selected.length + (selected.length === 1 ? ' propiedad seleccionada, su liga' : ' propiedades seleccionadas, sus ligas') + ' y los criterios de tu búsqueda.' : 'Puedes pedir asesoría aunque no hayas elegido una propiedad. Compartiremos tus criterios y el resultado para continuar la búsqueda.'}</p><span className="selection-count">{selected.length} {selected.length === 1 ? 'seleccionada' : 'seleccionadas'}</span></div>{!showContact && <button className="button primary" onClick={openContact}>Quiero que me contacten</button>}</section>}
    {showContact && !confirmation?.confirmed && <section className="wizard-card contact-form" id="advisor-contact"><span className="section-kicker">Solicitud de asesoría</span><h2>¿Cómo podemos contactarte?</h2><p className="muted">Solo usaremos estos datos para atender esta solicitud. Al enviar, el equipo recibirá tu reporte y las propiedades que seleccionaste.</p>
      {selectedProperties.length > 0 && <details className="report-preview"><summary>{selectedProperties.length === 1 ? 'Ver la propiedad que se enviará' : 'Ver las ' + selectedProperties.length + ' propiedades que se enviarán'}</summary><ul>{selectedProperties.map(property => <li key={property.id}><a href={property.sourceUrl} target="_blank" rel="noreferrer">{property.title}</a> · {currency(property.price)}</li>)}</ul></details>}
      {emailAvailable === false && <div className="alert error" role="alert">El envío al equipo necesita una revisión y puede fallar en este momento. Puedes volver a intentarlo más tarde.</div>}
      <form onSubmit={send}><div className="form-grid"><Field label="Nombre completo"><input autoComplete="name" minLength={3} maxLength={120} required value={contact.fullName} onChange={event => setContact(current => ({ ...current, fullName: event.target.value }))} /></Field><Field label="Teléfono o WhatsApp"><input autoComplete="tel" type="tel" minLength={8} maxLength={30} pattern="\+?[0-9 ()\-]{8,30}" required value={contact.phone} onChange={event => setContact(current => ({ ...current, phone: event.target.value }))} /></Field><Field label="Correo electrónico — opcional"><input type="email" autoComplete="email" maxLength={180} value={contact.email} onChange={event => setContact(current => ({ ...current, email: event.target.value }))} /></Field></div>
      <input className="honeypot" aria-label="Dejar vacío" tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact(current => ({ ...current, website: event.target.value }))} />
      <div className="consent-box"><label className="check consent"><input type="checkbox" required checked={contact.privacyAccepted} onChange={event => setContact(current => ({ ...current, privacyAccepted: event.target.checked }))} /><span>He leído y acepto el <Link to="/privacidad" target="_blank">Aviso de Privacidad</Link> y los <Link to="/terminos" target="_blank">Términos del Servicio</Link>.</span></label><label className="check consent"><input type="checkbox" required checked={contact.contactAccepted} onChange={event => setContact(current => ({ ...current, contactAccepted: event.target.checked }))} /><span>Solicito que un asesor de Círculo me contacte por teléfono, WhatsApp o correo para atender esta búsqueda.</span></label></div>
      {error && <div className="alert error" role="alert">{error}</div>}<div className="wizard-actions"><button type="button" className="button ghost" disabled={busy} onClick={() => setShowContact(false)}>Seguir comparando</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Enviando mi reporte…' : 'Enviar reporte y solicitar contacto'}</button></div></form>
    </section>}
    {confirmation?.confirmed && <section className="final-message confirmed" role="status"><strong>Tu reporte fue enviado al equipo de Círculo.</strong><p>{confirmation.message}</p><p>Folio: {confirmation.leadId.slice(0, 8)} · {confirmation.selectedPropertyIds.length} {confirmation.selectedPropertyIds.length === 1 ? 'propiedad de interés incluida' : 'propiedades de interés incluidas'}. Un asesor confirmará disponibilidad, precio y condiciones.</p><div><button className="button ghost" onClick={onNew}>Hacer otra búsqueda</button></div></section>}
    <div className="results-footer"><p>Los resultados describen los anuncios consultados, no todo el mercado. Los precios y la disponibilidad deben confirmarse antes de una visita o una decisión de compra.</p><button className="button ghost" onClick={onNew}>Comenzar otra búsqueda</button></div>
  </div>;
}

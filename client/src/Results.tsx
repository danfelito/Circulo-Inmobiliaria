import { useState } from 'react';
import { confirmLeadSelection } from './api';
import type { ConfirmationResponse, SearchResponse } from './types';

const currency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

export function Results({ result, onReconfigure, onNew, onApply }: { result: SearchResponse; onReconfigure: () => void; onNew: () => void; onApply: (text: string) => void }) {
  const found = result.matchCount > 0;
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResponse | null>(result.confirmationSent ? {
    confirmed: true,
    emailSent: result.emailSent,
    selectedPropertyIds: [],
    message: result.message,
  } : null);
  const [error, setError] = useState('');

  const toggleProperty = (id: string) => {
    if (confirmation?.confirmed) return;
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError('');
  };

  const confirmSelection = async () => {
    if (!selected.length) {
      setError('Palomea al menos una propiedad que te parezca interesante.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setConfirmation(await confirmLeadSelection(result.leadId, selected));
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible confirmar la selección.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-shell results-page">
    <section className={`result-hero ${found ? 'success' : 'empty'}`}>
      <span className="eyebrow">Consulta completada · Folio {result.leadId.slice(0, 8)}</span>
      <h1>{found ? 'Encontramos opciones que puedes revisar.' : 'Confirmada tu requisición.'}</h1>
      <p>{found
        ? `Localizamos ${result.matchCount} opción(es) preliminar(es) en las fuentes configuradas. Abre los anuncios, palomea las propiedades que te interesen y confirma tu selección.`
        : 'No localizamos coincidencias verificables en las fuentes configuradas, pero los datos de tu búsqueda quedaron registrados para seguimiento del asesor.'}</p>
      <div className="metrics"><span><b>{result.metrics.completeness}%</b> solicitud completa</span><span><b>{result.matchCount}</b> opciones preliminares</span><span><b>{result.sourcesConsulted}</b> fuentes consultadas</span></div>
    </section>

    {found && <section className="property-selection">
      <div className="section-heading"><div><span className="section-kicker">Opciones encontradas</span><h2>Selecciona las propiedades de tu interés</h2><p>Consulta cada anuncio en su fuente original. El correo al asesor incluirá únicamente las opciones palomeadas y sus ligas.</p></div><strong className="selection-count">{selected.length} seleccionada(s)</strong></div>
      <div className="property-grid">{result.matches.map((property) => {
        const checked = selected.includes(property.id);
        return <article key={property.id} className={`property-card selectable ${checked ? 'selected' : ''}`}>
          <label className="property-check"><input type="checkbox" checked={checked} disabled={Boolean(confirmation?.confirmed)} onChange={() => toggleProperty(property.id)} /><span>{checked ? 'Seleccionada' : 'Me interesa'}</span></label>
          <div className="property-top"><span className="score">{property.matchScore}%</span><span className="demo-badge">{property.sourceName}</span></div>
          <h3>{property.title}</h3>
          <p className="location">{property.city}{property.neighborhood ? ` · ${property.neighborhood}` : ''}</p>
          <strong className="price">{currency(property.price)}</strong>
          <div className="facts"><span>{property.bedrooms} rec.</span><span>{property.bathrooms} baños</span><span>{property.parking} est.</span><span>{property.constructionArea || property.landArea || 0} m²</span></div>
          {property.reasons.length > 0 && <ul className="reason-list">{property.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          {property.sourceUrl && property.sourceUrl !== '#' ? <a className="source-button" href={property.sourceUrl} target="_blank" rel="noreferrer">Ver anuncio original</a> : <span className="source-unavailable">Propiedad de catálogo interno</span>}
        </article>;
      })}</div>
      {!confirmation?.confirmed && <div className="selection-confirm"><div><strong>¿Ya elegiste?</strong><p>Al confirmar, se enviará a Patyestr el perfil del cliente y las ligas de las propiedades seleccionadas.</p></div><button className="button primary" disabled={busy} onClick={confirmSelection}>{busy ? 'Enviando selección…' : 'Confirmar requisición'}</button></div>}
      {error && <div className="alert error" role="alert">{error}</div>}
    </section>}

    {!found && <section className="no-results"><span className="section-kicker">Seguimiento manual</span><h2>La búsqueda quedó confirmada</h2><p>El asesor recibirá los datos del cliente, presupuesto, zona y características solicitadas para continuar la búsqueda.</p>{result.analysis.pressurePoints.length > 0 && <ul>{result.analysis.pressurePoints.map((item) => <li key={item}>{item}</li>)}</ul>}</section>}

    {!found && <section className="alternatives"><div><span className="section-kicker">Opciones adicionales</span><h2>También puedes ajustar la búsqueda</h2></div><div className="alternative-list">{result.analysis.suggestions.map((suggestion) => <button key={suggestion} onClick={() => onApply(suggestion)}><span>{suggestion}</span><b>Aplicar</b></button>)}</div></section>}

    <div className={`final-message ${confirmation?.confirmed ? 'confirmed' : ''}`}>
      <strong>{confirmation?.message || result.message}</strong>
      <p>{confirmation?.confirmed
        ? confirmation.emailSent ? 'La información y las ligas seleccionadas fueron enviadas al correo del asesor.' : 'La requisición quedó registrada; el correo está pendiente de configuración en el servidor.'
        : result.disclaimer}</p>
      {result.emailWarning && !result.emailSent && <p className="email-warning">Diagnóstico de correo: {result.emailWarning}</p>}
      <div><button className="button ghost" onClick={onReconfigure}>Reconfigurar búsqueda</button><button className="button ghost" onClick={onNew}>Nueva solicitud</button></div>
    </div>
  </div>;
}

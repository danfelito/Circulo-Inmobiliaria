import type { SearchResponse } from './types';

export function Results({ result, onReconfigure, onNew, onApply }: { result: SearchResponse; onReconfigure: () => void; onNew: () => void; onApply: (text: string) => void }) {
  const found = result.matchCount > 0;
  return <div className="page-shell results-page">
    <section className={`result-hero ${found ? 'success' : 'empty'}`}>
      <span className="eyebrow">Consulta completada · Folio {result.leadId.slice(0, 8)}</span>
      <h1>{found ? 'Sí encontramos opciones para tu solicitud.' : 'Aún no encontramos una coincidencia suficiente.'}</h1>
      <p>{found
        ? `Localizamos ${result.matchCount} opción(es) preliminar(es) en las fuentes configuradas. Un asesor verificará disponibilidad, condiciones y datos del anuncio antes de hacértelas llegar.`
        : 'La combinación actual no produjo opciones suficientes en las fuentes configuradas. Puedes ajustar uno o dos criterios sin volver a comenzar.'}</p>
      <div className="metrics"><span><b>{result.metrics.completeness}%</b> solicitud completa</span><span><b>{result.matchCount}</b> opciones preliminares</span><span><b>{result.sourcesConsulted}</b> fuentes consultadas</span></div>
    </section>
    {found ? <section className="advisor-notice"><div className="advisor-icon">✓</div><div><span className="section-kicker">Siguiente paso</span><h2>Tu asesor recibirá las propiedades encontradas</h2><p>No mostramos enlaces de portales ni anuncios sin verificar. El asesor recibirá por correo las opciones, sus características y las fuentes consultadas para revisarlas antes de contactarte.</p></div></section>
      : <section className="no-results"><span className="section-kicker">Revisión de criterios</span><h2>La combinación actual necesita ajustes</h2>{result.analysis.pressurePoints.length > 0 && <ul>{result.analysis.pressurePoints.map((item) => <li key={item}>{item}</li>)}</ul>}</section>}
    {!found && <section className="alternatives"><div><span className="section-kicker">Siguientes opciones</span><h2>Reconfigura sin comenzar desde cero</h2></div><div className="alternative-list">{result.analysis.suggestions.map((suggestion) => <button key={suggestion} onClick={() => onApply(suggestion)}><span>{suggestion}</span><b>Aplicar</b></button>)}</div></section>}
    <div className="final-message"><strong>{result.message}</strong><p>{result.disclaimer}</p><div><button className="button primary" onClick={onReconfigure}>Reconfigurar búsqueda</button><button className="button ghost" onClick={onNew}>Nueva solicitud</button></div></div>
  </div>;
}

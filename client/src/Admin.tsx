import { useCallback, useEffect, useState } from 'react';
import type { Provider } from './types';
import { Field } from './FormParts';

export function Admin() {
  const [token, setToken] = useState(localStorage.getItem('circulo-admin-token') || '');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadProviders = useCallback(async (activeToken: string) => {
    const response = await fetch('/api/admin/providers', { headers: { Authorization: `Bearer ${activeToken}` } });
    if (!response.ok) throw new Error('Sesión inválida.');
    setProviders(await response.json());
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadProviders(token).catch(() => { setToken(''); localStorage.removeItem('circulo-admin-token'); });
  }, [loadProviders, token]);

  const login = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: loginValue, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Credenciales inválidas.');
      localStorage.setItem('circulo-admin-token', data.token);
      setToken(data.token);
      await loadProviders(data.token);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Error de acceso.'); }
    finally { setBusy(false); }
  };

  const saveAll = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/providers', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ providers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron guardar las fuentes.');
      setProviders(data);
      setMessage('Las 10 fuentes quedaron guardadas y serán utilizadas en las próximas consultas.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las fuentes.'); }
    finally { setBusy(false); }
  };

  if (!token) return <div className="page-shell admin-login"><section className="wizard-card compact"><span className="section-kicker">Administración</span><h1>Acceso protegido</h1><p>Ingresa el correo o usuario autorizado y la clave administrativa.</p><Field label="Correo o usuario"><input autoComplete="username" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} /></Field><Field label="Clave"><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && login()} /></Field>{message && <div className="alert error">{message}</div>}<button className="button primary" disabled={busy} onClick={login}>{busy ? 'Verificando…' : 'Ingresar'}</button></section></div>;

  return <div className="page-shell admin"><div className="section-heading"><div><span className="section-kicker">Administración</span><h1>Fuentes de búsqueda</h1><p>Registra hasta 10 ligas. El sistema las consultará internamente y enviará al asesor las propiedades localizadas; el cliente no verá las ligas.</p></div></div>{message && <div className="alert">{message}</div>}
    <div className="provider-list">{providers.map((provider, index) => <div className="provider-row sources-only" key={provider.id}><span className="provider-number">{index + 1}</span><input aria-label={`Nombre fuente ${index + 1}`} value={provider.name} placeholder={`Fuente ${index + 1}`} onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, name: event.target.value } : p))}/><input aria-label={`Liga fuente ${index + 1}`} value={provider.baseUrl} placeholder="https://sitio.com o liga de búsqueda" onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, baseUrl: event.target.value } : p))}/><label className="mini-toggle"><input type="checkbox" checked={provider.enabled} onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, enabled: event.target.checked } : p))}/><span>{provider.enabled ? 'Activa' : 'Inactiva'}</span></label></div>)}</div>
    <div className="admin-save"><button className="button primary" disabled={busy} onClick={saveAll}>{busy ? 'Guardando…' : 'Guardar las 10 fuentes'}</button><button className="button ghost" onClick={() => { localStorage.removeItem('circulo-admin-token'); setToken(''); }}>Cerrar sesión</button></div>
  </div>;
}

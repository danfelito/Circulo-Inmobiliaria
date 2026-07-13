import { useCallback, useEffect, useState } from 'react';
import type { Provider } from './types';
import { Field } from './FormParts';

type AdminStatus = {
  ok: boolean;
  login: string;
  model: string;
  openaiConfigured: boolean;
  supabaseConfigured: boolean;
  email: { configured: boolean; recipient: string; sender: string; provider: string };
  activeSources: number;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || `Error ${response.status}`, response.status);
  return data;
}

export function Admin() {
  const [token, setToken] = useState(localStorage.getItem('circulo-admin-token') || '');
  const [loginValue, setLoginValue] = useState('circulointernacionalveracruz1@gmail.com');
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const authorizedFetch = useCallback(async (path: string, activeToken: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${activeToken}` } });
    return readJson(response);
  }, []);

  const loadAdmin = useCallback(async (activeToken: string) => {
    const [providerData, statusData] = await Promise.all([
      authorizedFetch('/api/admin/providers', activeToken),
      authorizedFetch('/api/admin/status', activeToken),
    ]);
    setProviders(providerData as Provider[]);
    setStatus(statusData as AdminStatus);
  }, [authorizedFetch]);

  useEffect(() => {
    if (!token) return;
    void loadAdmin(token).catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem('circulo-admin-token');
        setToken('');
        setMessage('La sesión venció. Ingresa nuevamente.');
      } else {
        setMessage(error instanceof Error ? `La sesión sigue activa, pero no fue posible cargar el panel: ${error.message}` : 'No fue posible cargar el panel.');
      }
    });
  }, [loadAdmin, token]);

  const login = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await readJson(await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: loginValue, password }) }));
      localStorage.setItem('circulo-admin-token', data.token);
      setToken(data.token);
      await loadAdmin(data.token);
      setMessage('Acceso correcto.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error de acceso.');
    } finally { setBusy(false); }
  };

  const saveAll = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await authorizedFetch('/api/admin/providers', token, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providers }) });
      setProviders(data as Provider[]);
      await loadAdmin(token);
      setMessage('Las 10 fuentes quedaron guardadas y serán utilizadas en las próximas consultas.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las fuentes.'); }
    finally { setBusy(false); }
  };

  const testEmail = async () => {
    setBusy(true); setMessage('');
    try {
      const data = await authorizedFetch('/api/admin/test-email', token, { method: 'POST' });
      setMessage(`Correo de prueba enviado a ${data.recipient}. Identificador: ${data.id || 'sin identificador'}.`);
    } catch (error) { setMessage(error instanceof Error ? `No se pudo enviar el correo de prueba: ${error.message}` : 'No se pudo enviar el correo de prueba.'); }
    finally { setBusy(false); }
  };

  if (!token) return <div className="page-shell admin-login"><section className="wizard-card compact"><span className="section-kicker">Administración</span><h1>Acceso protegido</h1><p>Ingresa el correo autorizado y la clave administrativa.</p><Field label="Correo o usuario"><input autoComplete="username" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} /></Field><Field label="Clave"><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && login()} /></Field>{message && <div className="alert error">{message}</div>}<button className="button primary" disabled={busy} onClick={login}>{busy ? 'Verificando…' : 'Ingresar'}</button></section></div>;

  return <div className="page-shell admin"><div className="section-heading"><div><span className="section-kicker">Administración</span><h1>Fuentes de búsqueda</h1><p>Registra hasta 10 ligas. El sistema las consultará internamente y enviará al asesor las propiedades localizadas; el cliente no verá las ligas.</p></div></div>
    {message && <div className={message.startsWith('No ') || message.includes('venció') ? 'alert error' : 'alert'}>{message}</div>}
    {status && <section className="summary-grid admin-status"><div className="summary"><small>Modelo</small><strong>{status.model}</strong></div><div className="summary"><small>OpenAI</small><strong>{status.openaiConfigured ? 'Configurado' : 'Falta API key'}</strong></div><div className="summary"><small>Correo</small><strong>{status.email.configured ? status.email.recipient : 'Sin configurar'}</strong></div><div className="summary"><small>Fuentes activas</small><strong>{status.activeSources}</strong></div></section>}
    <div className="provider-list">{providers.map((provider, index) => <div className="provider-row sources-only" key={provider.id}><span className="provider-number">{index + 1}</span><input aria-label={`Nombre fuente ${index + 1}`} value={provider.name} placeholder={`Fuente ${index + 1}`} onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, name: event.target.value } : p))}/><input aria-label={`Liga fuente ${index + 1}`} value={provider.baseUrl} placeholder="https://sitio.com o liga de búsqueda" onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, baseUrl: event.target.value } : p))}/><label className="mini-toggle"><input type="checkbox" checked={provider.enabled} onChange={(event) => setProviders((all) => all.map((p) => p.id === provider.id ? { ...p, enabled: event.target.checked } : p))}/><span>{provider.enabled ? 'Activa' : 'Inactiva'}</span></label></div>)}</div>
    <div className="admin-save"><button className="button ghost" disabled={busy} onClick={testEmail}>Probar correo</button><button className="button primary" disabled={busy} onClick={saveAll}>{busy ? 'Procesando…' : 'Guardar las 10 fuentes'}</button><button className="button ghost" onClick={() => { localStorage.removeItem('circulo-admin-token'); setToken(''); setStatus(null); }}>Cerrar sesión</button></div>
  </div>;
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Shell({ children }: { children: ReactNode }) {
  return <>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Círculo Internacional de Bienes Raíces"><img src="/logo.png" alt="Círculo Internacional" /></Link>
      <nav><Link to="/">Nueva búsqueda</Link><Link to="/privacidad">Privacidad</Link><Link to="/admin">Administración</Link></nav>
    </header>
    <main>{children}</main>
    <footer><span>© {new Date().getFullYear()} Círculo Internacional de Bienes Raíces</span><span>Precios y disponibilidad sujetos a confirmación por un asesor.</span></footer>
  </>;
}

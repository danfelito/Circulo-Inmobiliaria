import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Shell({ children }: { children: ReactNode }) {
  return <>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Círculo Internacional de Bienes Raíces">
        <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
        <span className="brand-lettering"><strong>CÍRCULO INTERNACIONAL</strong><b>BIENES RAÍCES</b></span>
      </Link>
      <nav>
        <Link to="/">Nueva búsqueda</Link>
        <Link to="/privacidad">Privacidad</Link>
        <Link to="/admin">Administración</Link>
        <a
          className="sibling-site-link"
          href="https://circulo-bienes-raices-1.onrender.com/"
          target="_blank"
          rel="noreferrer"
        >
          Portal de propiedades ↗
        </a>
      </nav>
    </header>
    <main>{children}</main>
    <footer>
      <span>© {new Date().getFullYear()} Círculo Internacional de Bienes Raíces</span>
      <a
        className="footer-site-link"
        href="https://circulo-bienes-raices-1.onrender.com/"
        target="_blank"
        rel="noreferrer"
      >
        Visitar el portal de propiedades ↗
      </a>
      <span>Precios y disponibilidad sujetos a confirmación por un asesor.</span>
    </footer>
  </>;
}

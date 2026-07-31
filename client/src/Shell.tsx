import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try {
    const savedTheme = window.localStorage.getItem('circulo-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch {
    // Continue with the operating-system preference when storage is unavailable.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Shell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem('circulo-theme', theme);
    } catch {
      // The selected theme still works for the current visit.
    }
  }, [theme]);

  const isDark = theme === 'dark';

  return <>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Círculo Internacional de Bienes Raíces">
        <img className="brand-mark" src="/brand-mark.svg" alt="" aria-hidden="true" />
        <span className="brand-lettering"><strong>CÍRCULO INTERNACIONAL</strong><b>BIENES RAÍCES</b></span>
      </Link>
      <div className="header-actions">
        <nav>
          <Link to="/">Nueva búsqueda</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/admin">Administración</Link>
          <a
            className="sibling-site-link"
            href="https://circulo-bienes-raices-2.onrender.com/propiedades"
            target="_blank"
            rel="noreferrer"
          >
            Portal de propiedades ↗
          </a>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Activar modo día' : 'Activar modo noche'}
          title={isDark ? 'Activar modo día' : 'Activar modo noche'}
        >
          <span className="theme-icon" aria-hidden="true">{isDark ? '☀' : '☾'}</span>
          <span className="theme-label">{isDark ? 'Modo día' : 'Modo noche'}</span>
        </button>
      </div>
    </header>
    <main>{children}</main>
    <footer>
      <span>© {new Date().getFullYear()} Círculo Internacional de Bienes Raíces</span>
      <a
        className="footer-site-link"
        href="https://circulo-bienes-raices-2.onrender.com/propiedades"
        target="_blank"
        rel="noreferrer"
      >
        Visitar el portal de propiedades ↗
      </a>
      <span>Precios y disponibilidad sujetos a confirmación por un asesor.</span>
    </footer>
  </>;
}

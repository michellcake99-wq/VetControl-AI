import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo.jsx';
import { secciones } from '../../data/paginaPublica.js';

export default function Navbar() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <header className={`lp-nav${abierto ? ' lp-nav--abierto' : ''}`}>
      <div className="lp-nav__barra">
        <Logo />
        <button
          type="button"
          className="lp-nav__toggle"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="lp-menu"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          {abierto ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div id="lp-menu" className="lp-nav__panel">
        <nav aria-label="Secciones">
          <ul className="lp-nav__menu">
            {secciones.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={i === 0 ? 'is-activo' : undefined}
                  onClick={cerrar}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lp-nav__acciones">
          <Link
            to="/iniciar-sesion"
            className="lp-boton lp-boton--borde"
            onClick={cerrar}
          >
            Iniciar sesión
          </Link>
          <Link to="/registro" className="lp-boton" onClick={cerrar}>
            Registrarse
          </Link>
        </div>
      </div>
    </header>
  );
}

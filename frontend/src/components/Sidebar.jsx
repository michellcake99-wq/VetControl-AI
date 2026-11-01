import { Link, NavLink } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { navItems } from '../routes.js';
import { usuario } from '../data/mockData.js';
import { iniciales } from '../utils/format.js';

export default function Sidebar({ abierto, onCerrar }) {
  return (
    <aside
      id="menu-principal"
      className={`sidebar${abierto ? ' sidebar--abierto' : ''}`}
      aria-label="Menú principal"
      // Cierra el menú móvil al elegir cualquier enlace
      onClick={(e) => e.target.closest('a') && onCerrar()}
    >
      <div className="sidebar__marca">
        <Link to="/inicio" className="marca">
          <span className="marca__emblema" aria-hidden="true">
            <Sparkles size={20} strokeWidth={2.2} />
          </span>
          <span className="marca__texto">
            <span className="marca__nombre">VetControl</span>
            <span className="marca__sub">AI · Cuidado inteligente</span>
          </span>
        </Link>
        <button
          type="button"
          className="sidebar__cerrar"
          onClick={onCerrar}
          aria-label="Cerrar menú"
        >
          <X size={22} />
        </button>
      </div>

      <nav className="nav">
        <ul>
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `nav__item${isActive ? ' nav__item--activo' : ''}`
                }
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__pie">
        <Link to="/ayuda" className="sidebar__bloque">
          <span className="circulo circulo--ayuda" aria-hidden="true">
            ?
          </span>
          <span>
            <span className="sidebar__titulo">¿Necesitas ayuda?</span>
            <span className="sidebar__sub">Estamos para ti</span>
          </span>
        </Link>
        <Link to="/perfil" className="sidebar__bloque">
          <span className="circulo circulo--cuenta" aria-hidden="true">
            {iniciales(usuario.nombre, usuario.apellido)}
          </span>
          <span>
            <span className="sidebar__titulo">Mi cuenta</span>
            <span className="sidebar__sub">{usuario.rol}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import emblema from '../assets/logo-emblema.png';
import { navItems } from '../routes.js';
import { usuario } from '../data/mockData.js';
import { iniciales } from '../utils/format.js';
import BotonCerrarSesion from './BotonCerrarSesion.jsx';
import { obtenerSesion } from '../utils/sesion.js';

const ETIQUETAS_ROL = {
  propietario: 'Propietario/a',
  veterinario: 'Veterinario/a',
  administrador: 'Administrador/a',
};

export default function Sidebar({ abierto, onCerrar }) {
  // Ep7-Hu1: el menú se arma con el rol del usuario que inició sesión (Ep3-Hu15).
  // Los datos de ejemplo de mockData.js solo se usan si por algún motivo no hay sesión.
  const cuenta = obtenerSesion()?.usuario ?? usuario;
  const rol = cuenta.rol;
  const etiquetaRol = ETIQUETAS_ROL[rol] ?? rol;
  const itemsVisibles = navItems.filter(
    (item) => !item.roles || item.roles.includes(rol)
  );

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
            <img src={emblema} alt="" width="38" height="38" />
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
          {itemsVisibles.map(({ to, label, etiquetas, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `nav__item${isActive ? ' nav__item--activo' : ''}`
                }
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{etiquetas?.[rol] ?? label}</span>
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
            {iniciales(cuenta.nombre, cuenta.apellido)}
          </span>
          <span>
            <span className="sidebar__titulo">Mi cuenta</span>
            <span className="sidebar__sub">{etiquetaRol}</span>
          </span>
        </Link>
        <BotonCerrarSesion />
      </div>
    </aside>
  );
}
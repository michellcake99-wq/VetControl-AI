import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { usuario, tieneNotificaciones } from '../data/mockData.js';
import { iniciales } from '../utils/format.js';

export default function Topbar({ onAbrirMenu, menuAbierto }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu"
        onClick={onAbrirMenu}
        aria-label="Abrir menú"
        aria-expanded={menuAbierto}
        aria-controls="menu-principal"
      >
        <Menu size={22} />
      </button>
      <p className="topbar__ruta">
        Portal de propietarios <span aria-hidden="true">/</span> VetControl AI
      </p>
      <div className="topbar__acciones">
        <Link
          to="/notificaciones"
          className="topbar__boton"
          aria-label={
            tieneNotificaciones
              ? 'Notificaciones (tienes nuevas)'
              : 'Notificaciones'
          }
        >
          <Bell size={18} strokeWidth={1.8} />
          {tieneNotificaciones && (
            <span className="topbar__punto" aria-hidden="true" />
          )}
        </Link>
        <Link
          to="/perfil"
          className="avatar"
          aria-label={`Perfil de ${usuario.nombre}`}
        >
          {iniciales(usuario.nombre, usuario.apellido)}
        </Link>
      </div>
    </header>
  );
}

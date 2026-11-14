import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { usuario, tieneNotificaciones } from '../data/mockData.js';
import { iniciales } from '../utils/format.js';
import { obtenerSesion } from '../utils/sesion.js';

const PORTAL_POR_ROL = {
  propietario: 'Portal de propietarios',
  veterinario: 'Portal veterinario',
  administrador: 'Panel de administración',
};

export default function Topbar({ onAbrirMenu, menuAbierto }) {
  // Datos del usuario que inició sesión (si no hay sesión, se usan los de ejemplo)
  const cuenta = obtenerSesion()?.usuario ?? usuario;
  const portal = PORTAL_POR_ROL[cuenta.rol] ?? 'Portal de propietarios';
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
        {portal} <span aria-hidden="true">/</span> VetControl AI
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
          aria-label={`Perfil de ${cuenta.nombre}`}
        >
          {iniciales(cuenta.nombre, cuenta.apellido)}
        </Link>
      </div>
    </header>
  );
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import { usuario } from '../data/mockData.js';
import { api } from '../services/api.js';
import { iniciales } from '../utils/format.js';
import { obtenerSesion } from '../utils/sesion.js';

const PORTAL_POR_ROL = {
  propietario: 'Portal de propietarios',
  veterinario: 'Portal veterinario',
  administrador: 'Panel de administración',
};

// Ep5-Hu1: número de notificaciones sin leer (se renueva cada minuto y cuando la página
// de notificaciones marca alguna como leída).
export const EVENTO_NOTIFICACIONES = 'vetcontrol:notificaciones';
const CADA_MS = 60 * 1000;

function useNoLeidas() {
  const [noLeidas, setNoLeidas] = useState(0);
  useEffect(() => {
    if (!obtenerSesion()?.token) return undefined;
    let activo = true;
    const cargar = () =>
      api
        .get('/notificaciones/no-leidas')
        .then((r) => activo && setNoLeidas(r.no_leidas))
        .catch(() => {});
    cargar();
    const reloj = setInterval(cargar, CADA_MS);
    window.addEventListener(EVENTO_NOTIFICACIONES, cargar);
    return () => {
      activo = false;
      clearInterval(reloj);
      window.removeEventListener(EVENTO_NOTIFICACIONES, cargar);
    };
  }, []);
  return noLeidas;
}

export default function Topbar({ onAbrirMenu, menuAbierto }) {
  // Datos del usuario que inició sesión (si no hay sesión, se usan los de ejemplo)
  const cuenta = obtenerSesion()?.usuario ?? usuario;
  const portal = PORTAL_POR_ROL[cuenta.rol] ?? 'Portal de propietarios';
  const noLeidas = useNoLeidas();
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
            noLeidas > 0
              ? `Notificaciones (${noLeidas} sin leer)`
              : 'Notificaciones'
          }
        >
          <Bell size={18} strokeWidth={1.8} />
          {noLeidas > 0 && (
            <span className="topbar__contador" aria-hidden="true">
              {noLeidas > 9 ? '9+' : noLeidas}
            </span>
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
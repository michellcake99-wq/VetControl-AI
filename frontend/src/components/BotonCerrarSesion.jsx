import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cerrarSesion } from '../utils/sesion.js';

export default function BotonCerrarSesion() {
  const navegar = useNavigate();
  const salir = () => {
    cerrarSesion();
    navegar('/iniciar-sesion', { replace: true });
  };
  return (
    <button type="button" className="sidebar__salir" onClick={salir}>
      <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>Cerrar sesión</span>
    </button>
  );
}

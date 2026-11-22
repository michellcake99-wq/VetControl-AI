import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cerrarSesion } from '../utils/sesion.js';

export default function BotonCerrarSesion() {
  const navegar = useNavigate();
  const salir = () => {
    cerrarSesion();
    // Ep7-Hu3: al cerrar sesión se vuelve a la página principal
    navegar('/', { replace: true });
  };
  return (
    <button type="button" className="sidebar__salir" onClick={salir}>
      <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>Cerrar sesión</span>
    </button>
  );
}

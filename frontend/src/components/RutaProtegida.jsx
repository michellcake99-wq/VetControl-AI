import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { obtenerSesion } from '../utils/sesion.js';

// Deja pasar solo a quien tiene sesión; si no, lo envía a iniciar sesión
// y recuerda la página que quería ver para volver a ella después.
export default function RutaProtegida({ children }) {
  const ubicacion = useLocation();
  if (!obtenerSesion()) {
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{ desde: ubicacion.pathname }}
      />
    );
  }
  return children ?? <Outlet />;
}

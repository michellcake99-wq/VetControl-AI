import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { obtenerSesion } from '../utils/sesion.js';

// Deja pasar solo a quien tiene sesión; si no, lo envía a iniciar sesión
// y recuerda la página que quería ver para volver a ella después.
// Ep7-Hu1: si se indican `roles` y el rol del usuario no está entre ellos,
// lo envía a la pantalla de acceso denegado.
export default function RutaProtegida({ roles, children }) {
  const ubicacion = useLocation();
  const sesion = obtenerSesion();
  if (!sesion) {
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{ desde: ubicacion.pathname }}
      />
    );
  }
  if (roles && !roles.includes(sesion.usuario?.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return children ?? <Outlet />;
}

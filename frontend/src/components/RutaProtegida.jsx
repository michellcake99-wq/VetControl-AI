import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  cerrarSesion,
  msParaVencer,
  obtenerSesion,
  sesionVencio,
} from '../utils/sesion.js';

// setTimeout no admite esperas mayores a ~24 días
const MAX_ESPERA_MS = 2 ** 31 - 1;

// Deja pasar solo a quien tiene sesión; si no, lo envía a iniciar sesión
// y recuerda la página que quería ver para volver a ella después.
// Ep7-Hu1: si se indican `roles` y el rol del usuario no está entre ellos,
// lo envía a la pantalla de acceso denegado.
export default function RutaProtegida({ roles, children }) {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const sesion = obtenerSesion();

  // Ep7-Hu3: si la persona deja la pantalla abierta hasta que vence el token (2 h),
  // se cierra la sesión y se la lleva al inicio de sesión con un aviso.
  useEffect(() => {
    const espera = msParaVencer();
    if (espera === null) return undefined;
    const reloj = setTimeout(
      () => {
        cerrarSesion();
        navegar('/iniciar-sesion', {
          replace: true,
          state: { expirada: true },
        });
      },
      Math.min(Math.max(espera, 0), MAX_ESPERA_MS)
    );
    return () => clearTimeout(reloj);
  }, [navegar, sesion?.token]);

  if (!sesion) {
    return (
      <Navigate
        to="/iniciar-sesion"
        replace
        state={{ desde: ubicacion.pathname, expirada: sesionVencio() }}
      />
    );
  }
  if (roles && !roles.includes(sesion.usuario?.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }
  return children ?? <Outlet />;
}
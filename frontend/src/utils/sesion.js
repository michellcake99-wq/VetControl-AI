// Manejo de la sesión del usuario (token JWT + datos básicos), guardada en localStorage.
// Si el navegador bloquea el almacenamiento, la sesión solo dura mientras no se recargue la página.
const CLAVE = 'vetcontrol_sesion';
let respaldo = null;

// Dashboard de cada rol. Hoy solo existe el portal del propietario (/inicio);
// cuando se construyan los del veterinario y del administrador, se cambian aquí.
const RUTA_POR_ROL = {
  propietario: '/inicio',
  veterinario: '/inicio',
  administrador: '/inicio',
};
export const rutaPorRol = (rol) => RUTA_POR_ROL[rol] ?? '/inicio';

// Lee la fecha de vencimiento (exp, en segundos) que trae el token
function venceEn(token) {
  try {
    const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(cuerpo)).exp * 1000;
  } catch {
    return 0;
  }
}

export function guardarSesion({ token, usuario }) {
  const sesion = { token, usuario };
  respaldo = sesion;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // sin almacenamiento disponible: se usa solo el respaldo en memoria
  }
}

export function cerrarSesion() {
  respaldo = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}

/** Devuelve { token, usuario } si hay una sesión vigente; si el token venció, la borra. */
export function obtenerSesion() {
  let sesion = respaldo;
  try {
    sesion = JSON.parse(localStorage.getItem(CLAVE)) ?? sesion;
  } catch {
    // se queda con el respaldo
  }
  if (!sesion?.token) return null;
  if (venceEn(sesion.token) <= Date.now()) {
    cerrarSesion();
    return null;
  }
  return sesion;
}

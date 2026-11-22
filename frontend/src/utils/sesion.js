// Manejo de la sesión del usuario (token JWT + datos básicos), guardada en localStorage.
// Si el navegador bloquea el almacenamiento, la sesión solo dura mientras no se recargue la página.
const CLAVE = 'vetcontrol_sesion';
let respaldo = null;
// Ep7-Hu3: se activa cuando se borra una sesión porque su token venció (para avisarlo al volver al login)
let vencio = false;

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

/** ¿La última sesión se cerró porque venció? (se limpia al iniciar sesión o al cerrarla a propósito) */
export const sesionVencio = () => vencio;

/** Milisegundos que le quedan al token de la sesión actual (null si no hay sesión). */
export function msParaVencer() {
  const sesion = obtenerSesion();
  return sesion ? venceEn(sesion.token) - Date.now() : null;
}

export function guardarSesion({ token, usuario }) {
  vencio = false;
  const sesion = { token, usuario };
  respaldo = sesion;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // sin almacenamiento disponible: se usa solo el respaldo en memoria
  }
}

/** Actualiza el nombre y apellido guardados en la sesión (para que la barra y el menú lo muestren al instante). */
export function actualizarUsuarioSesion(cambios) {
  const sesion = obtenerSesion();
  if (sesion)
    guardarSesion({ ...sesion, usuario: { ...sesion.usuario, ...cambios } });
}

export function cerrarSesion() {
  respaldo = null;
  vencio = false;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}

/** Rol del usuario con sesión ('propietario' | 'veterinario' | 'administrador') o null. */
export const rolActual = () => obtenerSesion()?.usuario?.rol ?? null;

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
    vencio = true;
    return null;
  }
  return sesion;
}
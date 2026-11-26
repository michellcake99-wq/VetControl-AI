import { io } from 'socket.io-client';
import { obtenerSesion } from '../utils/sesion.js';

// Ep8: el chat usa el token JWT de la sesión iniciada (Ep3-Hu15).
export const obtenerToken = () => obtenerSesion()?.token;

/** Datos del usuario que vienen dentro del token: { id_usuario, rol }. */
export function usuarioDelToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Ep7-Hu2: si el frontend y la API están en dominios distintos, se define VITE_API_URL (igual que services/api.js)
const URL_API = import.meta.env.VITE_API_URL ?? '';

async function pedir(metodo, url, body) {
  const res = await fetch(`${URL_API}/api${url}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${obtenerToken()}`,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.mensaje || 'Error de conexión');
  return datos;
}

export const chatApi = {
  conversaciones: () => pedir('GET', '/conversaciones'),
  veterinarios: () => pedir('GET', '/conversaciones/veterinarios'),
  misMascotas: () => pedir('GET', '/mascotas?limite=100').then((r) => r.datos),
  crearConversacion: (datos) => pedir('POST', '/conversaciones', datos),
  mensajes: (id) => pedir('GET', `/conversaciones/${id}/mensajes`),
};

/** Socket del chat: autentica con el mismo token JWT. */
export const conectarChat = (token) => io(URL_API || undefined, { auth: { token } });

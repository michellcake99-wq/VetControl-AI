// Cliente mínimo de la API de VetControl AI.
// En desarrollo, Vite reenvía /api al backend (ver vite.config.js); en producción debe
// publicarse en el mismo dominio o definir VITE_API_URL.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ErrorApi extends Error {
  constructor(mensaje, estado, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

async function peticion(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo && JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      0
    );
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorApi(
      datos.mensaje ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      respuesta.status,
      datos.detalles
    );
  }
  return datos;
}

// POST /api/auth/login -> { mensaje, token, usuario }
export const iniciarSesion = (correo, contrasena) =>
  peticion('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena } });

// POST /api/auth/register -> { mensaje, usuario }
export const registrarUsuario = (datos) =>
  peticion('/auth/register', { metodo: 'POST', cuerpo: datos });

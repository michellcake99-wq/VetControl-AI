import { api } from '../services/api.js';

// Datos reales del dashboard de inicio, según lo que el usuario puede ver por su rol:
// el propietario ve sus mascotas y sus citas; el veterinario, su agenda; el administrador, todo.

const ESTADOS_PENDIENTES = ['programada', 'reprogramada'];
const lista = (r) => (Array.isArray(r) ? r : (r?.datos ?? []));

function inicioDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

/**
 * Porcentaje de vacunas al día de un grupo de mascotas.
 * Por cada mascota se toma la aplicación más reciente de cada vacuna: está "al día"
 * si no necesita refuerzo o si la fecha de la próxima dosis todavía no ha pasado.
 * Devuelve null si ninguna mascota tiene vacunas registradas.
 */
export function porcentajeVacunasAlDia(vacunasPorMascota) {
  const hoy = inicioDeHoy();
  let total = 0;
  let alDia = 0;
  for (const vacunas of vacunasPorMascota) {
    const ultimaPorNombre = new Map();
    for (const v of vacunas) {
      const clave = v.nombre.trim().toLowerCase();
      const anterior = ultimaPorNombre.get(clave);
      if (
        !anterior ||
        new Date(v.fecha_aplicacion) > new Date(anterior.fecha_aplicacion)
      ) {
        ultimaPorNombre.set(clave, v);
      }
    }
    for (const v of ultimaPorNombre.values()) {
      total += 1;
      if (!v.proxima_dosis || new Date(v.proxima_dosis) >= hoy) alDia += 1;
    }
  }
  return total === 0 ? null : Math.round((alDia / total) * 100);
}

export async function cargarResumenInicio(rol) {
  const [respuestaMascotas, respuestaCitas] = await Promise.all([
    api.get('/mascotas?limite=100'),
    api.get(
      `/citas?desde=${inicioDeHoy().toISOString().slice(0, 10)}&limite=100`
    ),
  ]);

  const mascotas = lista(respuestaMascotas);
  const ahora = new Date();
  const citas = lista(respuestaCitas)
    .filter(
      (c) =>
        ESTADOS_PENDIENTES.includes(c.estado) && new Date(c.fecha_hora) > ahora
    )
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

  // Las vacunas se calculan solo para el propietario (pocas mascotas). Para el personal
  // de la clínica serían muchas consultas; ese indicador irá en su propio dashboard.
  let vacunasAlDia = null;
  if (rol === 'propietario' && mascotas.length > 0) {
    const historias = await Promise.all(
      mascotas.map((m) =>
        api.get(`/mascotas/${m.id_mascota}/historia`).catch(() => null)
      )
    );
    vacunasAlDia = porcentajeVacunasAlDia(
      historias.filter(Boolean).map((h) => h.vacunas ?? [])
    );
  }

  return {
    totalMascotas: respuestaMascotas?.meta?.total ?? mascotas.length,
    totalCitas: citas.length,
    proximaCita: citas[0] ?? null,
    vacunasAlDia,
    vacunasCalculadas: rol === 'propietario',
  };
}
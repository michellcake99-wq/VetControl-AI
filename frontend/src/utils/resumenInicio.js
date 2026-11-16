import { api } from '../services/api.js';

// Datos reales del dashboard de inicio, según lo que el usuario puede ver por su rol:
// el propietario ve sus mascotas y sus citas; el veterinario, su agenda; el administrador, todo.

const ESTADOS_PENDIENTES = ['programada', 'confirmada', 'reprogramada'];
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

/** Estado de una mascota para las tarjetas del inicio (solo propietario). */
function estadoMascota(historia) {
  if (!historia) return null;
  const porcentaje = porcentajeVacunasAlDia([historia.vacunas ?? []]);
  const tratamientosActivos = (historia.consultas ?? [])
    .flatMap((c) => c.tratamientos ?? [])
    .filter((t) => t.estado === 'activo').length;
  return {
    vacunas:
      porcentaje === null
        ? 'sin'
        : porcentaje === 100
          ? 'al-dia'
          : 'pendientes',
    tratamientosActivos,
  };
}

export async function cargarResumenInicio(rol) {
  const esPropietario = rol === 'propietario';
  const [respuestaMascotas, respuestaCitas] = await Promise.all([
    // El propietario necesita todas sus mascotas (para vacunas y tratamientos);
    // el personal solo unas pocas para el carrusel y el total
    api.get(esPropietario ? '/mascotas?limite=100' : '/mascotas?limite=8'),
    api.get(
      `/citas?desde=${inicioDeHoy().toISOString().slice(0, 10)}&limite=100&orden=asc`
    ),
  ]);

  const mascotas = lista(respuestaMascotas);
  const ahora = new Date();
  const pendientes = lista(respuestaCitas).filter((c) =>
    ESTADOS_PENDIENTES.includes(c.estado)
  );
  const citas = pendientes
    .filter((c) => new Date(c.fecha_hora) > ahora)
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  const hoy = new Date().toDateString();
  const citasHoy = pendientes.filter(
    (c) => new Date(c.fecha_hora).toDateString() === hoy
  ).length;

  // Vacunas y tratamientos se calculan solo para el propietario (pocas mascotas).
  // Para el personal de la clínica serían demasiadas consultas.
  let vacunasAlDia = null;
  let tratamientosActivos = null;
  let mascotasConEstado = mascotas;
  if (esPropietario && mascotas.length > 0) {
    const historias = await Promise.all(
      mascotas.map((m) =>
        api.get(`/mascotas/${m.id_mascota}/historia`).catch(() => null)
      )
    );
    vacunasAlDia = porcentajeVacunasAlDia(
      historias.filter(Boolean).map((h) => h.vacunas ?? [])
    );
    mascotasConEstado = mascotas.map((m, i) => ({
      ...m,
      estado: estadoMascota(historias[i]),
    }));
    tratamientosActivos = mascotasConEstado.reduce(
      (suma, m) => suma + (m.estado?.tratamientosActivos ?? 0),
      0
    );
  }

  return {
    mascotas: mascotasConEstado,
    totalMascotas: respuestaMascotas?.meta?.total ?? mascotas.length,
    totalCitas: citas.length,
    proximaCita: citas[0] ?? null,
    proximasCitas: citas.slice(0, 3),
    citasHoy,
    tratamientosActivos,
    vacunasAlDia,
    vacunasCalculadas: esPropietario,
  };
}
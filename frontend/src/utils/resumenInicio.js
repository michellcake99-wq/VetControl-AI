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
 * Porcentaje de vacunas al día de un grupo de mascotas (Ep5-Hu4).
 * Recibe el resumen de vacunas de cada mascota ({ total, al_dia }), que el backend calcula junto con
 * sus pendientes (GET /mascotas/:id/pendientes): una vacuna está "al día" si no necesita refuerzo o si
 * la fecha de su próxima dosis todavía no ha pasado. Devuelve null si no hay vacunas registradas.
 */
export function porcentajeVacunasAlDia(resumenesVacunas) {
  const total = resumenesVacunas.reduce((suma, v) => suma + v.total, 0);
  const alDia = resumenesVacunas.reduce((suma, v) => suma + v.al_dia, 0);
  return total === 0 ? null : Math.round((alDia / total) * 100);
}

/** Estado de una mascota para las tarjetas del inicio (solo propietario), a partir de sus pendientes. */
function estadoMascota(pendientes) {
  if (!pendientes) return null;
  const porcentaje = porcentajeVacunasAlDia([pendientes.vacunas]);
  const tratamientosActivos = pendientes.datos.filter(
    (p) => p.tipo === 'tratamiento'
  ).length;
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
    const pendientes = await Promise.all(
      mascotas.map((m) =>
        api.get(`/mascotas/${m.id_mascota}/pendientes`).catch(() => null)
      )
    );
    vacunasAlDia = porcentajeVacunasAlDia(
      pendientes.filter(Boolean).map((p) => p.vacunas)
    );
    mascotasConEstado = mascotas.map((m, i) => ({
      ...m,
      estado: estadoMascota(pendientes[i]),
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
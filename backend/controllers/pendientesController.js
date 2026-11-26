// Ep5-Hu4: visualización de los pendientes de la mascota.
// Junta en un solo lugar las próximas citas, las vacunas por aplicar o vencidas y los
// tratamientos activos, y calcula con esos mismos datos el porcentaje de vacunas al día
// (el que usa el dashboard).
const { query } = require('../utils/baseDatos');
const { obtenerMascotaAutorizada } = require('../utils/acceso');

// Las fechas se calculan en hora de Colombia/Ecuador (UTC-5), igual que las citas
const ZONA = 'America/Bogota';
// Estados de una cita que todavía está por atenderse
const ESTADOS_CITA_PENDIENTE = "('programada', 'confirmada', 'reprogramada')";
// Orden de desempate cuando dos pendientes caen el mismo día
const PRIORIDAD_TIPO = { cita: 0, vacuna: 1, tratamiento: 2 };

/** 'vencido' si la fecha (AAAA-MM-DD) ya pasó; 'proximo' si es hoy o más adelante. */
const estadoPorFecha = (fecha, hoy) => (fecha < hoy ? 'vencido' : 'proximo');

// Próximas citas de la mascota (solo las que aún no han ocurrido)
async function citasPendientes(idMascota, hoy) {
    const { rows } = await query(
        `SELECT c.id_cita, c.fecha_hora, c.motivo, c.tipo_consulta, c.estado AS estado_cita,
                (c.fecha_hora AT TIME ZONE $2)::date AS fecha,
                uv.nombre || ' ' || uv.apellido AS nombre_veterinario
           FROM citas c
           JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
           JOIN usuarios uv ON uv.id_usuario = v.id_usuario
          WHERE c.id_mascota = $1 AND c.estado IN ${ESTADOS_CITA_PENDIENTE} AND c.fecha_hora >= now()`,
        [idMascota, ZONA]
    );
    return rows.map((c) => ({
        tipo: 'cita',
        id: c.id_cita,
        titulo: c.motivo,
        fecha: c.fecha,
        fecha_hora: c.fecha_hora,
        estado: estadoPorFecha(c.fecha, hoy),
        estado_cita: c.estado_cita,
        tipo_consulta: c.tipo_consulta,
        nombre_veterinario: c.nombre_veterinario,
    }));
}

// Última aplicación de cada vacuna: si ya se aplicó el refuerzo, la dosis anterior deja de contar
async function ultimasVacunas(idMascota) {
    const { rows } = await query(
        `SELECT DISTINCT ON (lower(trim(v.nombre)))
                v.id_vacuna, v.nombre, v.fecha_aplicacion, v.proxima_dosis
           FROM vacunas v
           JOIN historias_clinicas h ON h.id_historia = v.id_historia
          WHERE h.id_mascota = $1
          ORDER BY lower(trim(v.nombre)), v.fecha_aplicacion DESC, v.id_vacuna DESC`,
        [idMascota]
    );
    return rows;
}

// Tratamientos que siguen activos
async function tratamientosActivos(idMascota) {
    const { rows } = await query(
        `SELECT t.id_tratamiento, t.id_consulta, t.medicamento, t.dosis, t.frecuencia, t.via,
                t.fecha_inicio, t.fecha_fin
           FROM tratamientos t
           JOIN consultas c ON c.id_consulta = t.id_consulta
           JOIN historias_clinicas h ON h.id_historia = c.id_historia
          WHERE h.id_mascota = $1 AND t.estado = 'activo'`,
        [idMascota]
    );
    return rows;
}

// GET /api/mascotas/:id/pendientes
// El propietario solo ve los de sus mascotas (403 si es de otro); el personal ve los de cualquiera.
async function listar(req, res) {
    const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
    const hoy = (await query('SELECT (now() AT TIME ZONE $1)::date AS hoy', [ZONA])).rows[0].hoy; // 'AAAA-MM-DD'

    const [citas, vacunas, tratamientos] = await Promise.all([
        citasPendientes(mascota.id_mascota, hoy),
        ultimasVacunas(mascota.id_mascota),
        tratamientosActivos(mascota.id_mascota),
    ]);

    // Vacunas por aplicar (próxima dosis futura) o vencidas (próxima dosis ya pasada)
    const pendientesVacunas = vacunas
        .filter((v) => v.proxima_dosis)
        .map((v) => ({
            tipo: 'vacuna',
            id: v.id_vacuna,
            titulo: v.nombre,
            fecha: v.proxima_dosis,
            estado: estadoPorFecha(v.proxima_dosis, hoy),
            fecha_aplicacion: v.fecha_aplicacion,
        }));

    // Tratamiento activo: vence si su fecha de fin ya pasó y sigue sin cerrarse; sin fecha de fin está en curso
    const pendientesTratamientos = tratamientos.map((t) => ({
        tipo: 'tratamiento',
        id: t.id_tratamiento,
        titulo: t.medicamento,
        fecha: t.fecha_fin ?? t.fecha_inicio,
        estado: t.fecha_fin ? estadoPorFecha(t.fecha_fin, hoy) : 'proximo',
        id_consulta: t.id_consulta,
        dosis: t.dosis,
        frecuencia: t.frecuencia,
        via: t.via,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
    }));

    // Del más cercano al más lejano (los vencidos, al ser fechas pasadas, quedan primero)
    const datos = [...citas, ...pendientesVacunas, ...pendientesTratamientos].sort(
        (a, b) =>
            a.fecha.localeCompare(b.fecha) ||
            (a.fecha_hora && b.fecha_hora ? new Date(a.fecha_hora) - new Date(b.fecha_hora) : 0) ||
            PRIORIDAD_TIPO[a.tipo] - PRIORIDAD_TIPO[b.tipo] ||
            a.id - b.id
    );

    // Porcentaje de vacunas al día: una vacuna está al día si no necesita refuerzo o si su
    // próxima dosis todavía no ha pasado. null si la mascota no tiene vacunas registradas.
    const alDia = vacunas.filter((v) => !v.proxima_dosis || v.proxima_dosis >= hoy).length;

    res.json({
        mascota: { id_mascota: mascota.id_mascota, nombre: mascota.nombre, especie: mascota.especie },
        fecha_corte: hoy,
        total: datos.length,
        vencidos: datos.filter((p) => p.estado === 'vencido').length,
        vacunas: {
            total: vacunas.length,
            al_dia: alDia,
            porcentaje: vacunas.length === 0 ? null : Math.round((alDia / vacunas.length) * 100),
        },
        datos,
    });
}

module.exports = { listar };

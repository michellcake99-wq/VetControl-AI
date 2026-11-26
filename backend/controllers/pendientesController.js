// Ep5-Hu4: visualización de los pendientes de la mascota.
// Junta en un solo lugar las próximas citas, las vacunas por aplicar o vencidas y los
// tratamientos activos, y calcula con esos mismos datos el porcentaje de vacunas al día
// (el que usa el dashboard).
const { query } = require('../utils/baseDatos');
const { obtenerMascotaAutorizada } = require('../utils/acceso');
const { ErrorHttp } = require('../utils/errores');

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

// -----------------------------------------------------------------------------
// Ep6-Hu3: identificación GLOBAL de información clínica pendiente/desactualizada.
// Se implementa en este mismo controlador para compartir el dominio de pendientes
// con Ep5-Hu4, sin duplicar controladores ni rutas.
// -----------------------------------------------------------------------------
const ROLES_PERSONAL = ['veterinario', 'administrador'];

function exigirPersonal(usuario) {
    if (!ROLES_PERSONAL.includes(usuario?.rol)) {
        throw new ErrorHttp(403, 'Solo el personal veterinario puede consultar los pendientes clínicos');
    }
}

/**
 * Consulta los pendientes vigentes de todas las mascotas activas.
 * No guarda una copia: cada llamada recalcula los resultados desde PostgreSQL.
 */
async function obtenerPendientesClinicos() {
    const { rows: fechaRows } = await query(
        `SELECT (now() AT TIME ZONE $1)::date::text AS hoy`, [ZONA]
    );
    const hoy = fechaRows[0].hoy;

    const [vacunas, tratamientos, seguimientos] = await Promise.all([
        // Solo se evalúa la aplicación más reciente de cada vacuna por mascota y nombre.
        query(
            `SELECT m.id_mascota, m.nombre AS nombre_mascota, m.especie,
                    h.id_historia, h.numero AS numero_historia,
                    ultima.id_vacuna AS id_registro, ultima.nombre AS detalle,
                    ultima.proxima_dosis AS fecha_pendiente,
                    'vacuna'::text AS tipo,
                    'La próxima dosis de la vacuna está vencida'::text AS motivo
               FROM (
                    SELECT DISTINCT ON (h.id_mascota, lower(trim(v.nombre)))
                           v.id_vacuna, v.id_historia, v.nombre, v.proxima_dosis,
                           h.id_mascota
                      FROM vacunas v
                      JOIN historias_clinicas h ON h.id_historia = v.id_historia
                     WHERE v.proxima_dosis IS NOT NULL
                     ORDER BY h.id_mascota, lower(trim(v.nombre)),
                              v.fecha_aplicacion DESC, v.id_vacuna DESC
               ) ultima
               JOIN historias_clinicas h ON h.id_historia = ultima.id_historia
               JOIN mascotas m ON m.id_mascota = h.id_mascota
              WHERE m.activo = TRUE AND ultima.proxima_dosis < $1::date
              ORDER BY ultima.proxima_dosis ASC, m.nombre ASC`,
            [hoy]
        ),
        // Sin fecha_fin no se considera vencido: el tratamiento puede seguir en curso.
        query(
            `SELECT m.id_mascota, m.nombre AS nombre_mascota, m.especie,
                    h.id_historia, h.numero AS numero_historia,
                    t.id_tratamiento AS id_registro, t.medicamento AS detalle,
                    t.fecha_fin AS fecha_pendiente,
                    'tratamiento'::text AS tipo,
                    'El tratamiento sigue activo aunque su fecha de finalización ya pasó'::text AS motivo
               FROM tratamientos t
               JOIN consultas c ON c.id_consulta = t.id_consulta
               JOIN historias_clinicas h ON h.id_historia = c.id_historia
               JOIN mascotas m ON m.id_mascota = h.id_mascota
              WHERE m.activo = TRUE
                AND t.estado = 'activo'
                AND t.fecha_fin IS NOT NULL
                AND t.fecha_fin < $1::date
              ORDER BY t.fecha_fin ASC, m.nombre ASC`,
            [hoy]
        ),
        // Incluye mascotas sin consultas y aquellas cuya última consulta supera 90 días.
        query(
            `SELECT m.id_mascota, m.nombre AS nombre_mascota, m.especie,
                    h.id_historia, h.numero AS numero_historia,
                    NULL::int AS id_registro,
                    'Seguimiento clínico'::text AS detalle,
                    ultima.fecha_ultima_consulta AS fecha_pendiente,
                    'sin_consulta'::text AS tipo,
                    CASE WHEN ultima.fecha_ultima_consulta IS NULL
                         THEN 'La mascota no tiene consultas registradas'
                         ELSE 'La última consulta fue hace más de 90 días'
                    END::text AS motivo
               FROM mascotas m
               JOIN historias_clinicas h ON h.id_mascota = m.id_mascota
               LEFT JOIN LATERAL (
                    SELECT max(c.fecha)::date AS fecha_ultima_consulta
                      FROM consultas c
                     WHERE c.id_historia = h.id_historia
               ) ultima ON TRUE
              WHERE m.activo = TRUE
                AND (ultima.fecha_ultima_consulta IS NULL
                     OR ultima.fecha_ultima_consulta < $1::date - INTERVAL '90 days')
              ORDER BY ultima.fecha_ultima_consulta NULLS FIRST, m.nombre ASC`,
            [hoy]
        ),
    ]);

    const normalizar = (filas) => filas.map((p) => ({
        ...p,
        fecha_pendiente: p.fecha_pendiente ? String(p.fecha_pendiente).slice(0, 10) : null,
        id_mascota: Number(p.id_mascota),
        id_historia: Number(p.id_historia),
        id_registro: p.id_registro == null ? null : Number(p.id_registro),
        sugerencia: null,
    }));

    const datos = [
        ...normalizar(vacunas.rows),
        ...normalizar(tratamientos.rows),
        ...normalizar(seguimientos.rows),
    ].sort((a, b) => {
        // Los registros sin fecha (mascotas sin consultas) quedan al final.
        if (!a.fecha_pendiente && b.fecha_pendiente) return 1;
        if (a.fecha_pendiente && !b.fecha_pendiente) return -1;
        return (a.fecha_pendiente || '').localeCompare(b.fecha_pendiente || '')
            || a.nombre_mascota.localeCompare(b.nombre_mascota);
    });

    return {
        fecha_corte: hoy,
        total: datos.length,
        resumen: {
            vacunas_vencidas: vacunas.rowCount,
            tratamientos_sin_cerrar: tratamientos.rowCount,
            sin_consulta_90_dias: seguimientos.rowCount,
        },
        datos,
    };
}

// GET /api/mascotas/pendientes-clinicos — solo veterinario/administrador.
async function listarGlobal(req, res) {
    exigirPersonal(req.usuario);
    res.json(await obtenerPendientesClinicos());
}

/** Recupera el pendiente vigente antes de solicitar una sugerencia a la IA. */
async function obtenerPendienteParaIA({ id_mascota, tipo, id_registro }) {
    const listado = await obtenerPendientesClinicos();
    const pendiente = listado.datos.find((p) =>
        p.id_mascota === id_mascota && p.tipo === tipo
        && (tipo === 'sin_consulta' || p.id_registro === id_registro)
    );
    if (!pendiente) {
        throw new ErrorHttp(404, 'El pendiente ya no existe o la información clínica fue actualizada');
    }
    return pendiente;
}

module.exports = {
    listar,
    listarGlobal,
    obtenerPendientesClinicos,
    obtenerPendienteParaIA,
    exigirPersonal,
};

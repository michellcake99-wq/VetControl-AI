// Notificaciones y recordatorios (Ep5). Todo vive en la tabla «recordatorios»:
//   - aparece en la campana cuando llega su fecha_programada (y no está cancelado);
//   - un proceso periódico (utils/planificador.js) envía además el correo.
const { query } = require('./baseDatos');
const { enviarCorreo } = require('./correo');

const ZONA = 'America/Bogota';
const HORAS_ANTES_CITA = 24;

const formatoFecha = (fecha) =>
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', timeZone: ZONA }).format(new Date(fecha));

/** Los errores de notificación nunca deben tumbar la acción principal (crear cita, etc.). */
async function sinRomper(fn) {
    try {
        return await fn();
    } catch (error) {
        console.error('No se pudo registrar la notificación:', error.message);
    }
}

/** Notificación inmediata para un usuario (por ejemplo «nueva cita solicitada»). */
async function crearAviso(idUsuario, { titulo, mensaje, enlace = null, idMascota = null, idReferencia = null }) {
    await query(
        `INSERT INTO recordatorios (id_usuario, id_mascota, tipo, id_referencia, titulo, mensaje, enlace, fecha_programada)
         VALUES ($1, $2, 'aviso', $3, $4, $5, $6, now())`,
        [idUsuario, idMascota, idReferencia, titulo, mensaje.slice(0, 300), enlace]
    );
}

async function datosCita(idCita) {
    const { rows } = await query(
        `SELECT c.id_cita, c.id_mascota, c.fecha_hora, c.estado, m.nombre AS mascota,
                p.id_usuario AS usuario_propietario, v.id_usuario AS usuario_veterinario,
                uv.nombre || ' ' || uv.apellido AS veterinario,
                uo.nombre || ' ' || uo.apellido AS propietario
         FROM citas c
         JOIN mascotas m ON m.id_mascota = c.id_mascota
         JOIN propietarios p ON p.id_propietario = m.id_propietario
         JOIN usuarios uo ON uo.id_usuario = p.id_usuario
         JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
         JOIN usuarios uv ON uv.id_usuario = v.id_usuario
         WHERE c.id_cita = $1`,
        [idCita]
    );
    return rows[0];
}

/**
 * Deja los recordatorios de una cita acordes con su estado actual:
 *  - confirmada: recordatorio 24 h antes (si ya falta menos, se avisa de inmediato);
 *  - cualquier otro estado, o cambio de fecha: se cancelan los recordatorios pendientes que ya no valen.
 * Nunca crea el mismo recordatorio dos veces (índice único uq_recordatorios_evento).
 */
async function sincronizarRecordatorioCita(idCita) {
    const cita = await datosCita(idCita);
    if (!cita) return;
    const vigente = cita.estado === 'confirmada' && new Date(cita.fecha_hora) > new Date();

    await query(
        `UPDATE recordatorios SET estado = 'cancelado'
         WHERE tipo = 'cita' AND id_referencia = $1 AND estado = 'pendiente'
           AND ($2::boolean = FALSE OR fecha_evento IS DISTINCT FROM $3::timestamptz)`,
        [idCita, vigente, cita.fecha_hora]
    );
    if (!vigente) return;

    const mensaje =
        `Recordatorio: ${cita.mascota} tiene cita con ${cita.veterinario} ` +
        `el ${formatoFecha(cita.fecha_hora)}`;
    await query(
        `INSERT INTO recordatorios
           (id_usuario, id_mascota, tipo, id_referencia, titulo, mensaje, enlace, fecha_programada, fecha_evento)
         VALUES ($1, $2, 'cita', $3, 'Recordatorio de cita', $4, '/citas',
                 GREATEST($5::timestamptz - make_interval(hours => $6), now()), $5)
         ON CONFLICT (id_usuario, tipo, id_referencia, fecha_evento)
           WHERE fecha_evento IS NOT NULL AND estado <> 'cancelado' DO NOTHING`,
        [cita.usuario_propietario, cita.id_mascota, idCita, mensaje, cita.fecha_hora, HORAS_ANTES_CITA]
    );
}

/** Avisa al veterinario de que un propietario pidió una cita. */
async function avisarCitaSolicitada(idCita) {
    const cita = await datosCita(idCita);
    if (!cita) return;
    await crearAviso(cita.usuario_veterinario, {
        titulo: 'Nueva cita solicitada',
        mensaje: `${cita.propietario} solicitó una cita para ${cita.mascota} el ${formatoFecha(cita.fecha_hora)}`,
        enlace: '/citas',
        idMascota: cita.id_mascota,
        idReferencia: idCita,
    });
}

/**
 * Envía los pendientes que ya llegaron a su hora. Cada recordatorio se «reclama» con un UPDATE
 * antes de enviarlo, así que aunque corran dos procesos nunca sale el mismo correo dos veces.
 */
async function procesarPendientes() {
    const { rows } = await query(
        `UPDATE recordatorios r SET estado = 'enviado'
         WHERE r.id_recordatorio IN (
           SELECT id_recordatorio FROM recordatorios
           WHERE estado = 'pendiente' AND fecha_programada <= now()
           ORDER BY fecha_programada LIMIT 50 FOR UPDATE SKIP LOCKED)
         RETURNING r.id_recordatorio, r.id_usuario, r.titulo, r.mensaje`
    );
    let correos = 0;
    for (const r of rows) {
        const { rows: u } = await query('SELECT correo, nombre FROM usuarios WHERE id_usuario = $1', [r.id_usuario]);
        if (!u[0]) continue;
        try {
            const res = await enviarCorreo({ para: u[0].correo, nombre: u[0].nombre, asunto: r.titulo || 'VetControl AI', texto: r.mensaje });
            if (res.enviado) {
                correos++;
                await query('UPDATE recordatorios SET fecha_envio = now() WHERE id_recordatorio = $1', [r.id_recordatorio]);
            }
        } catch (error) {
            console.error('Falló el envío del correo:', error.message);
            await query("UPDATE recordatorios SET estado = 'fallido' WHERE id_recordatorio = $1", [r.id_recordatorio]);
        }
    }
    return { procesados: rows.length, correos };
}

module.exports = { crearAviso, sincronizarRecordatorioCita, avisarCitaSolicitada, procesarPendientes, sinRomper, formatoFecha };

// Notificaciones y recordatorios (Ep5). Todo vive en la tabla «recordatorios»:
//   - aparece en la campana cuando llega su fecha_programada (y no está cancelado);
//   - un proceso periódico (utils/planificador.js) envía además el correo.
const { query } = require('./baseDatos');
const { enviarCorreo } = require('./correo');
const { horasEntreDosis } = require('./frecuencia');

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


const fechaDia = (dia) =>
    new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));

const DIAS_ANTES_VACUNA = 7;

/**
 * Ep5-Hu2: deja el recordatorio de la próxima dosis de una vacuna acorde con su registro.
 *  - Con «proxima_dosis» vigente: recordatorio 7 días antes (8:00 a. m., hora de la clínica).
 *    Si ya falta menos, se avisa de inmediato.
 *  - Si la fecha cambia o se quita, el recordatorio pendiente se cancela y se crea el nuevo.
 *  - Si la dosis ya se aplicó (hay un registro posterior de la misma vacuna para esa mascota)
 *    o la fecha ya pasó, no se recuerda más.
 */
async function sincronizarRecordatorioVacuna(idVacuna) {
    const { rows } = await query(
        `SELECT va.id_vacuna, va.nombre, va.proxima_dosis, va.fecha_aplicacion, m.id_mascota, m.nombre AS mascota,
                p.id_usuario AS usuario_propietario,
                (va.proxima_dosis IS NOT NULL AND va.proxima_dosis >= (now() AT TIME ZONE '${ZONA}')::date) AS futura,
                EXISTS (SELECT 1 FROM vacunas v2 JOIN historias_clinicas h2 ON h2.id_historia = v2.id_historia
                         WHERE h2.id_mascota = m.id_mascota AND lower(v2.nombre) = lower(va.nombre)
                           AND (v2.fecha_aplicacion > va.fecha_aplicacion
                                OR (v2.fecha_aplicacion = va.fecha_aplicacion AND v2.id_vacuna > va.id_vacuna))) AS ya_aplicada,
                (va.proxima_dosis::timestamp AT TIME ZONE '${ZONA}') AS evento,
                GREATEST(((va.proxima_dosis - ${DIAS_ANTES_VACUNA})::timestamp + interval '8 hours') AT TIME ZONE '${ZONA}', now()) AS programada
           FROM vacunas va
           JOIN historias_clinicas h ON h.id_historia = va.id_historia
           JOIN mascotas m ON m.id_mascota = h.id_mascota
           JOIN propietarios p ON p.id_propietario = m.id_propietario
          WHERE va.id_vacuna = $1`,
        [idVacuna]
    );
    const v = rows[0];
    if (!v) return;
    const vigente = v.futura && !v.ya_aplicada;

    await query(
        `UPDATE recordatorios SET estado = 'cancelado'
         WHERE tipo = 'vacuna' AND id_referencia = $1 AND estado = 'pendiente'
           AND ($2::boolean = FALSE OR fecha_evento IS DISTINCT FROM $3::timestamptz)`,
        [idVacuna, vigente, v.evento]
    );
    if (!vigente) return;

    const mensaje = `Recordatorio: ${v.mascota} debe recibir la dosis de la vacuna ${v.nombre} el ${fechaDia(v.proxima_dosis)}.`;
    await query(
        `INSERT INTO recordatorios
           (id_usuario, id_mascota, tipo, id_referencia, titulo, mensaje, enlace, fecha_programada, fecha_evento)
         VALUES ($1, $2, 'vacuna', $3, 'Recordatorio de vacuna', $4, '/vacunas', $5, $6)
         ON CONFLICT (id_usuario, tipo, id_referencia, fecha_evento)
           WHERE fecha_evento IS NOT NULL AND estado <> 'cancelado' DO NOTHING`,
        [v.usuario_propietario, v.id_mascota, idVacuna, mensaje.slice(0, 300), v.programada, v.evento]
    );
}

/** Revisa todas las vacunas de la misma mascota y nombre (un registro nuevo cierra el recordatorio del anterior). */
async function sincronizarVacunasRelacionadas(idVacuna) {
    const { rows } = await query(
        `SELECT v2.id_vacuna FROM vacunas va
           JOIN historias_clinicas h ON h.id_historia = va.id_historia
           JOIN historias_clinicas h2 ON h2.id_mascota = h.id_mascota
           JOIN vacunas v2 ON v2.id_historia = h2.id_historia AND lower(v2.nombre) = lower(va.nombre)
          WHERE va.id_vacuna = $1`,
        [idVacuna]
    );
    for (const { id_vacuna } of rows) await sincronizarRecordatorioVacuna(id_vacuna);
}


const diaBogota = (fecha) => new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA });
const HORA_PRIMERA_DOSIS = '08:00:00-05:00';

/**
 * Ep5-Hu3: genera el recordatorio de la dosis que le toca ahora a cada tratamiento activo.
 * Las dosis se cuentan desde las 8:00 a. m. del día de inicio, cada «frecuencia» (cada 8 horas, diaria...).
 * Solo se recuerda la dosis más reciente (si el servidor estuvo apagado no se envía un montón de avisos
 * atrasados) y nunca dos veces la misma. No se genera nada si el tratamiento no está activo, ya terminó
 * (fecha_fin pasada) o aún no empieza.
 */
async function generarRecordatoriosTratamientos(ahora = new Date()) {
    const { rows } = await query(
        `SELECT t.id_tratamiento, t.medicamento, t.dosis, t.frecuencia, t.fecha_inicio, t.fecha_fin, t.fecha_registro,
                m.id_mascota, m.nombre AS mascota, p.id_usuario AS usuario_propietario
           FROM tratamientos t
           JOIN consultas c ON c.id_consulta = t.id_consulta
           JOIN historias_clinicas h ON h.id_historia = c.id_historia
           JOIN mascotas m ON m.id_mascota = h.id_mascota
           JOIN propietarios p ON p.id_propietario = m.id_propietario
           JOIN usuarios u ON u.id_usuario = p.id_usuario
          WHERE t.estado = 'activo' AND u.activo AND m.activo
            AND t.fecha_inicio <= (now() AT TIME ZONE '${ZONA}')::date
            AND (t.fecha_fin IS NULL OR t.fecha_fin >= (now() AT TIME ZONE '${ZONA}')::date)`
    );
    let creados = 0;
    for (const t of rows) {
        const horas = horasEntreDosis(t.frecuencia) ?? 24; // frecuencia que no se entiende: una vez al día
        const paso = horas * 3600000;
        const inicio = new Date(`${t.fecha_inicio}T${HORA_PRIMERA_DOSIS}`).getTime();
        const k = Math.floor((ahora.getTime() - inicio) / paso);
        if (k < 0) continue;
        const dosis = new Date(inicio + k * paso);
        if (dosis < new Date(t.fecha_registro)) continue; // la dosis es anterior a que se recetara el tratamiento
        if (t.fecha_fin && diaBogota(dosis) > t.fecha_fin) continue;

        const hora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA }).format(dosis);
        const mensaje = `Hora del tratamiento: ${t.mascota} debe recibir ${t.medicamento}, ${t.dosis} (${t.frecuencia}) — ${hora}.`;
        const r = await query(
            `INSERT INTO recordatorios
               (id_usuario, id_mascota, tipo, id_referencia, titulo, mensaje, enlace, fecha_programada, fecha_evento)
             VALUES ($1, $2, 'tratamiento', $3, 'Recordatorio de tratamiento', $4, $5, $6, $6)
             ON CONFLICT (id_usuario, tipo, id_referencia, fecha_evento)
               WHERE fecha_evento IS NOT NULL AND estado <> 'cancelado' DO NOTHING`,
            [t.usuario_propietario, t.id_mascota, t.id_tratamiento, mensaje.slice(0, 300), `/mascotas/${t.id_mascota}/historia`, dosis]
        );
        creados += r.rowCount;
    }
    return { creados };
}

/** Si el tratamiento ya no está activo, se retiran los recordatorios que aún no se enviaron. */
async function cancelarRecordatoriosTratamiento(idTratamiento) {
    await query(
        "UPDATE recordatorios SET estado = 'cancelado' WHERE tipo = 'tratamiento' AND id_referencia = $1 AND estado = 'pendiente'",
        [idTratamiento]
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


const TEXTO_ESTADO = {
    confirmada: ['Cita confirmada', 'fue confirmada'],
    cancelada: ['Cita cancelada', 'fue cancelada'],
    atendida: ['Cita completada', 'se completó'],
    no_asistio: ['Cita sin asistencia', 'quedó registrada como «no asistió»'],
};

/**
 * Ep5-Hu6: avisa del cambio de estado de una cita. Si lo hizo el personal de la clínica se avisa al propietario;
 * si el propietario cancela su propia cita, se avisa al veterinario.
 */
async function avisarCambioEstadoCita(idCita, rolQuienCambia) {
    const cita = await datosCita(idCita);
    const texto = TEXTO_ESTADO[cita?.estado];
    if (!texto) return;
    const aPropietario = rolQuienCambia !== 'propietario';
    await crearAviso(aPropietario ? cita.usuario_propietario : cita.usuario_veterinario, {
        titulo: texto[0],
        mensaje: `La cita de ${cita.mascota} del ${formatoFecha(cita.fecha_hora)} ${texto[1]}.`,
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

module.exports = { crearAviso, sincronizarRecordatorioCita, sincronizarVacunasRelacionadas,
    generarRecordatoriosTratamientos, cancelarRecordatoriosTratamiento, avisarCitaSolicitada, avisarCambioEstadoCita, procesarPendientes, sinRomper, formatoFecha };
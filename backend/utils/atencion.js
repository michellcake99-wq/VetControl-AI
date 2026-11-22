// Ep8-Hu4: estado de atención del veterinario (en línea / fuera de línea y horario de atención)
const { query } = require('./baseDatos');

const ZONA = 'America/Bogota';
const DIAS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// ------------------------------------------------------------------
//  Presencia: un veterinario está «en línea» mientras tenga al menos un
//  socket del chat abierto (puede tener varias pestañas o dispositivos).
// ------------------------------------------------------------------
const conectados = new Map(); // id_veterinario -> Set de ids de socket

/** Devuelve true si es la primera conexión del veterinario (acaba de pasar a «en línea»). */
function marcarConectado(idVeterinario, idSocket) {
    const sockets = conectados.get(idVeterinario) ?? new Set();
    const eraNuevo = sockets.size === 0;
    sockets.add(idSocket);
    conectados.set(idVeterinario, sockets);
    return eraNuevo;
}

/** Devuelve true si era su última conexión (acaba de pasar a «fuera de línea»). */
function marcarDesconectado(idVeterinario, idSocket) {
    const sockets = conectados.get(idVeterinario);
    if (!sockets || !sockets.delete(idSocket)) return false;
    if (sockets.size > 0) return false;
    conectados.delete(idVeterinario);
    return true;
}

const estaEnLinea = (idVeterinario) => (conectados.get(idVeterinario)?.size ?? 0) > 0;

// ------------------------------------------------------------------
//  Horario de atención (siempre en hora de Colombia)
// ------------------------------------------------------------------

/** Día de la semana (1 = lunes ... 7 = domingo) y minutos desde la medianoche en la zona horaria. */
function momentoEnZona(ahora = new Date(), zona = ZONA) {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(ahora);
    const valor = (tipo) => partes.find((p) => p.type === tipo).value;
    return { dia: DIAS[valor('weekday')], minutos: Number(valor('hour')) * 60 + Number(valor('minute')) };
}

const aMinutos = (hora) => {
    const [h, m] = String(hora).split(':');
    return Number(h) * 60 + Number(m);
};
const aHHMM = (hora) => String(hora).slice(0, 5);

/**
 * Dice si el veterinario está en horario de atención y, si no, cuándo vuelve a atender.
 * @param horarios filas de horarios_veterinario: { dia_semana, hora_inicio, hora_fin }
 * @returns { en_horario: true|false|null, proxima_atencion: { dia_semana, hora_inicio, hoy } | null }
 *          en_horario es null cuando el veterinario no tiene horario registrado.
 */
function estadoHorario(horarios, ahora = new Date()) {
    if (!horarios.length) return { en_horario: null, proxima_atencion: null };
    const { dia, minutos } = momentoEnZona(ahora);
    const franjas = horarios
        .map((h) => ({ dia: h.dia_semana, ini: aMinutos(h.hora_inicio), fin: aMinutos(h.hora_fin), hora: aHHMM(h.hora_inicio) }))
        .sort((a, b) => a.dia - b.dia || a.ini - b.ini);

    if (franjas.some((f) => f.dia === dia && f.ini <= minutos && minutos < f.fin)) {
        return { en_horario: true, proxima_atencion: null };
    }
    // Siguiente franja: primero lo que falta hoy y después los próximos 7 días
    for (let salto = 0; salto <= 7; salto++) {
        const diaBuscado = ((dia - 1 + salto) % 7) + 1;
        const siguiente = franjas.find((f) => f.dia === diaBuscado && (salto > 0 || f.ini > minutos));
        if (siguiente) {
            return {
                en_horario: false,
                proxima_atencion: { dia_semana: diaBuscado, hora_inicio: siguiente.hora, hoy: salto === 0 },
            };
        }
    }
    return { en_horario: false, proxima_atencion: null };
}

/** Estado completo de cada veterinario indicado: { [id_veterinario]: estado_atencion }. */
async function estadosDeAtencion(idsVeterinario, ahora = new Date()) {
    const ids = [...new Set(idsVeterinario.filter(Boolean))];
    const porVeterinario = new Map(ids.map((id) => [id, []]));
    if (ids.length) {
        const { rows } = await query(
            `SELECT id_veterinario, dia_semana, hora_inicio, hora_fin
               FROM horarios_veterinario WHERE id_veterinario = ANY($1::int[])
              ORDER BY dia_semana, hora_inicio`,
            [ids]
        );
        for (const fila of rows) porVeterinario.get(fila.id_veterinario).push(fila);
    }
    const estados = {};
    for (const [id, horarios] of porVeterinario) {
        estados[id] = {
            id_veterinario: id,
            en_linea: estaEnLinea(id),
            ...estadoHorario(horarios, ahora),
            horario: horarios.map((h) => ({
                dia_semana: h.dia_semana, hora_inicio: aHHMM(h.hora_inicio), hora_fin: aHHMM(h.hora_fin),
            })),
        };
    }
    return estados;
}

/** "lunes a las 7:00 a. m." / "hoy a las 2:00 p. m." para los avisos escritos. */
function textoProximaAtencion(proxima) {
    if (!proxima) return null;
    const [h, m] = proxima.hora_inicio.split(':').map(Number);
    const hora = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
    return `${proxima.hoy ? 'hoy' : `el ${NOMBRES_DIA[proxima.dia_semana]}`} a las ${hora}`;
}

/** Aviso que se le da al propietario cuando escribe fuera del horario de atención (o null si no aplica). */
function avisoFueraDeHorario(estado) {
    if (!estado || estado.en_horario !== false) return null;
    const cuando = textoProximaAtencion(estado.proxima_atencion);
    return `El veterinario está fuera de su horario de atención. Tu mensaje quedó guardado y te responderá cuando vuelva a atender${
        cuando ? ` (${cuando})` : ''
    }.`;
}

/** Sala de Socket.IO a la que se unen quienes siguen el estado de un veterinario. */
const salaEstado = (idVeterinario) => `estado-veterinario:${idVeterinario}`;

/** Avisa en tiempo real a quienes siguen al veterinario que su horario cambió (si el chat está encendido). */
function avisarCambioHorario(app, idVeterinario) {
    app.get('io')?.to(salaEstado(idVeterinario)).emit('horario_actualizado', { id_veterinario: idVeterinario });
}

module.exports = {
    avisarCambioHorario,
    marcarConectado, marcarDesconectado, estaEnLinea,
    momentoEnZona, estadoHorario, estadosDeAtencion, textoProximaAtencion, avisoFueraDeHorario, salaEstado,
};
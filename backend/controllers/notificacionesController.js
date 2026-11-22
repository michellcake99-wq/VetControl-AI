const { query } = require('../utils/baseDatos');
const { noEncontrado } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');

// Una notificación se ve cuando llega su hora y no fue cancelada (p. ej. cita cancelada)
const VISIBLE = "id_usuario = $1 AND fecha_programada <= now() AND estado <> 'cancelado'";

// GET /api/notificaciones?solo_no_leidas=true&pagina=&limite=
async function listar(req, res) {
    const pag = paginar(req);
    const filtro = req.query.solo_no_leidas === 'true' ? `${VISIBLE} AND leido = FALSE` : VISIBLE;
    const total = (await query(`SELECT count(*)::int AS n FROM recordatorios WHERE ${filtro}`, [req.usuario.id_usuario])).rows[0].n;
    const { rows } = await query(
        `SELECT id_recordatorio AS id_notificacion, tipo, titulo, mensaje, enlace, id_mascota, id_referencia,
                fecha_programada AS fecha, leido, fecha_lectura
         FROM recordatorios WHERE ${filtro}
         ORDER BY fecha_programada DESC, id_recordatorio DESC LIMIT $2 OFFSET $3`,
        [req.usuario.id_usuario, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/notificaciones/no-leidas — número que se muestra en la campana
async function contarNoLeidas(req, res) {
    const { rows } = await query(`SELECT count(*)::int AS no_leidas FROM recordatorios WHERE ${VISIBLE} AND leido = FALSE`, [
        req.usuario.id_usuario,
    ]);
    res.json(rows[0]);
}

// PATCH /api/notificaciones/:id/leida — solo las propias
async function marcarLeida(req, res) {
    const { rows } = await query(
        `UPDATE recordatorios SET leido = TRUE, fecha_lectura = COALESCE(fecha_lectura, now())
         WHERE id_recordatorio = $1 AND id_usuario = $2 AND fecha_programada <= now() AND estado <> 'cancelado'
         RETURNING id_recordatorio AS id_notificacion, leido, fecha_lectura`,
        [Number(req.params.id), req.usuario.id_usuario]
    );
    if (!rows[0]) throw noEncontrado('Notificación');
    res.json(rows[0]);
}

// POST /api/notificaciones/marcar-leidas — todas las pendientes de leer
async function marcarTodasLeidas(req, res) {
    const { rowCount } = await query(
        `UPDATE recordatorios SET leido = TRUE, fecha_lectura = now() WHERE ${VISIBLE} AND leido = FALSE`,
        [req.usuario.id_usuario]
    );
    res.json({ marcadas: rowCount });
}

module.exports = { listar, contarNoLeidas, marcarLeida, marcarTodasLeidas };

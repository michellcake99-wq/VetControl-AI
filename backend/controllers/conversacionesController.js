const { query } = require('../utils/baseDatos');
const { noEncontrado, sinPermiso } = require('../utils/errores');
const { obtenerMascotaAutorizada } = require('../utils/acceso');

/**
 * Conversación visible solo para sus dos participantes (el propietario y el veterinario).
 * Devuelve también el id_usuario de cada uno, que usa el chat en tiempo real.
 */
async function obtenerConversacionAutorizada(idConversacion, usuario) {
    const { rows } = await query(
        `SELECT c.*, p.id_usuario AS usuario_propietario, v.id_usuario AS usuario_veterinario
           FROM conversaciones c
           JOIN propietarios p ON p.id_propietario = c.id_propietario
           JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
          WHERE c.id_conversacion = $1`,
        [idConversacion]
    );
    const conversacion = rows[0];
    if (!conversacion) throw noEncontrado('Conversación');
    const participa = (usuario.id_propietario && usuario.id_propietario === conversacion.id_propietario)
        || (usuario.id_veterinario && usuario.id_veterinario === conversacion.id_veterinario);
    if (!participa) throw sinPermiso();
    return conversacion;
}

/** Guarda un mensaje (remitente, contenido y fecha) y lo devuelve. Lo usa sockets/chat.js. */
async function guardarMensaje(idConversacion, idRemitente, contenido) {
    const { rows } = await query(
        `INSERT INTO mensajes (id_conversacion, id_remitente, contenido)
         VALUES ($1, $2, $3) RETURNING *`,
        [idConversacion, idRemitente, contenido]
    );
    return rows[0];
}

// GET /api/conversaciones/veterinarios — a quién le puede escribir el propietario
async function listarVeterinarios(_req, res) {
    const { rows } = await query(
        `SELECT v.id_veterinario, u.nombre, u.apellido, v.especialidad
           FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
          WHERE u.activo
          ORDER BY u.nombre, u.apellido`
    );
    res.json(rows);
}

// GET /api/conversaciones — conversaciones del usuario, con último mensaje y no leídos
async function listar(req, res) {
    const { id_usuario, id_propietario = null, id_veterinario = null } = req.usuario;
    const { rows } = await query(
        `SELECT c.id_conversacion, c.id_propietario, c.id_veterinario, c.id_mascota, c.fecha_registro,
                m.nombre AS nombre_mascota,
                CASE WHEN c.id_propietario = $2 THEN uv.nombre || ' ' || uv.apellido
                     ELSE up.nombre || ' ' || up.apellido END AS nombre_contacto,
                (SELECT count(*)::int FROM mensajes x
                  WHERE x.id_conversacion = c.id_conversacion AND NOT x.leido AND x.id_remitente <> $1) AS no_leidos,
                ultimo.mensaje AS ultimo_mensaje
           FROM conversaciones c
           JOIN propietarios p ON p.id_propietario = c.id_propietario
           JOIN usuarios up    ON up.id_usuario = p.id_usuario
           JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
           JOIN usuarios uv    ON uv.id_usuario = v.id_usuario
           LEFT JOIN mascotas m ON m.id_mascota = c.id_mascota
           LEFT JOIN LATERAL (
                SELECT json_build_object('contenido', x.contenido, 'id_remitente', x.id_remitente,
                                         'fecha_envio', x.fecha_envio) AS mensaje, x.fecha_envio
                  FROM mensajes x WHERE x.id_conversacion = c.id_conversacion
                 ORDER BY x.fecha_envio DESC, x.id_mensaje DESC LIMIT 1
           ) ultimo ON TRUE
          WHERE c.id_propietario = $2 OR c.id_veterinario = $3
          ORDER BY COALESCE(ultimo.fecha_envio, c.fecha_registro) DESC`,
        [id_usuario, id_propietario, id_veterinario]
    );
    res.json(rows);
}

// POST /api/conversaciones — el propietario inicia (o retoma) una conversación con un veterinario
async function crear(req, res) {
    const { id_veterinario, id_mascota = null } = req.body;
    const veterinario = await query(
        `SELECT v.id_veterinario FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
          WHERE v.id_veterinario = $1 AND u.activo`,
        [id_veterinario]
    );
    if (!veterinario.rows[0]) throw noEncontrado('Veterinario');
    if (id_mascota) await obtenerMascotaAutorizada(id_mascota, req.usuario);   // debe ser una mascota suya

    // Si ya existe la conversación se reutiliza (IS NOT DISTINCT FROM también compara NULL)
    const existente = await query(
        `SELECT * FROM conversaciones
          WHERE id_propietario = $1 AND id_veterinario = $2 AND id_mascota IS NOT DISTINCT FROM $3`,
        [req.usuario.id_propietario, id_veterinario, id_mascota]
    );
    if (existente.rows[0]) return res.json(existente.rows[0]);

    const { rows } = await query(
        `INSERT INTO conversaciones (id_propietario, id_veterinario, id_mascota)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.usuario.id_propietario, id_veterinario, id_mascota]
    );
    res.status(201).json(rows[0]);
}

// GET /api/conversaciones/:id/mensajes — historial (también lo que llegó estando desconectado)
async function listarMensajes(req, res) {
    const conversacion = await obtenerConversacionAutorizada(Number(req.params.id), req.usuario);
    const { rows } = await query(
        'SELECT * FROM mensajes WHERE id_conversacion = $1 ORDER BY fecha_envio, id_mensaje',
        [conversacion.id_conversacion]
    );
    res.json(rows);
}

// PUT /api/conversaciones/:id/leidos — al abrir la conversación se marcan como leídos los recibidos
async function marcarLeidos(req, res) {
    const conversacion = await obtenerConversacionAutorizada(Number(req.params.id), req.usuario);
    const resultado = await query(
        `UPDATE mensajes SET leido = TRUE
          WHERE id_conversacion = $1 AND id_remitente <> $2 AND NOT leido`,
        [conversacion.id_conversacion, req.usuario.id_usuario]
    );
    res.json({ actualizados: resultado.rowCount });
}

module.exports = {
    obtenerConversacionAutorizada, guardarMensaje,
    listarVeterinarios, listar, crear, listarMensajes, marcarLeidos,
};

const { query } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado, sinPermiso } = require('../utils/errores');
const esquemas = require('../validators/esquemas');
const { obtenerMascotaAutorizada } = require('../utils/acceso');
const { estadosDeAtencion } = require('../utils/atencion');

/**
 * Conversación visible solo para sus dos participantes (el propietario y el veterinario).
 */
async function obtenerConversacionAutorizada(idConversacion, usuario) {
    const { rows } = await query(
        'SELECT * FROM conversaciones WHERE id_conversacion = $1',
        [idConversacion]
    );
    const conversacion = rows[0];
    if (!conversacion) throw noEncontrado('Conversación');
    const participa = (usuario.id_propietario && usuario.id_propietario === conversacion.id_propietario)
        || (usuario.id_veterinario && usuario.id_veterinario === conversacion.id_veterinario);
    if (!participa) throw sinPermiso();
    return conversacion;
}

/**
 * Ep8-Hu5: antes de guardar un mensaje se comprueba que la otra persona siga activa.
 * Un propietario solo puede escribirle a veterinarios activos (y viceversa).
 */
async function verificarPuedeEscribir(conversacion, usuario) {
    const { rows } = await query(
        `SELECT uv.activo AS veterinario_activo, up.activo AS propietario_activo
           FROM conversaciones c
           JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
           JOIN usuarios uv    ON uv.id_usuario = v.id_usuario
           JOIN propietarios p ON p.id_propietario = c.id_propietario
           JOIN usuarios up    ON up.id_usuario = p.id_usuario
          WHERE c.id_conversacion = $1`,
        [conversacion.id_conversacion]
    );
    const estado = rows[0];
    if (usuario.rol === 'propietario' && !estado?.veterinario_activo) {
        throw sinPermiso('El veterinario ya no está activo; no puede enviarle mensajes');
    }
    if (usuario.rol === 'veterinario' && !estado?.propietario_activo) {
        throw sinPermiso('El propietario ya no está activo; no puede enviarle mensajes');
    }
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
    // Ep8-Hu4: cada veterinario con su estado de atención (en línea y horario)
    const estados = await estadosDeAtencion(rows.map((v) => v.id_veterinario));
    res.json(rows.map((v) => ({ ...v, estado_atencion: estados[v.id_veterinario] })));
}

// GET /api/conversaciones — conversaciones del usuario, con su último mensaje
async function listar(req, res) {
    const { id_propietario = null, id_veterinario = null } = req.usuario;
    const { rows } = await query(
        `SELECT c.id_conversacion, c.id_propietario, c.id_veterinario, c.id_mascota, c.fecha_registro,
                m.nombre AS nombre_mascota,
                CASE WHEN c.id_propietario = $1 THEN uv.nombre || ' ' || uv.apellido
                     ELSE up.nombre || ' ' || up.apellido END AS nombre_contacto,
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
          WHERE c.id_propietario = $1 OR c.id_veterinario = $2
          ORDER BY COALESCE(ultimo.fecha_envio, c.fecha_registro) DESC`,
        [id_propietario, id_veterinario]
    );
    // Ep8-Hu4: el propietario ve el estado de atención de cada veterinario con el que conversa
    if (req.usuario.rol !== 'propietario') return res.json(rows);
    const estados = await estadosDeAtencion(rows.map((c) => c.id_veterinario));
    res.json(rows.map((c) => ({ ...c, estado_atencion: estados[c.id_veterinario] })));
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

// GET /api/conversaciones/:id/mensajes?antes=<id_mensaje>&limite=30 — historial por páginas (Ep8-Hu3)
// Sin `antes` devuelve los mensajes más recientes; con `antes`, los inmediatamente anteriores a ese
// mensaje. Siempre salen en orden cronológico (del más antiguo al más reciente) y `hay_mas`
// indica si quedan mensajes todavía más antiguos para seguir cargando.
async function listarMensajes(req, res) {
    const conversacion = await obtenerConversacionAutorizada(Number(req.params.id), req.usuario);
    const resultado = esquemas.mensajesListar.safeParse(req.query);
    if (!resultado.success) {
        const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
        throw new ErrorHttp(400, 'Datos inválidos', detalles);
    }
    const { antes, limite } = resultado.data;

    const parametros = [conversacion.id_conversacion];
    let corte = '';
    if (antes) {
        // El mensaje de referencia debe pertenecer a esta conversación (no se pueden leer otras)
        const ref = await query(
            'SELECT 1 FROM mensajes WHERE id_mensaje = $1 AND id_conversacion = $2',
            [antes, conversacion.id_conversacion]
        );
        if (!ref.rows[0]) throw new ErrorHttp(400, 'El mensaje indicado en «antes» no pertenece a esta conversación');
        // La comparación se hace en SQL para no perder los microsegundos de fecha_envio
        parametros.push(antes);
        corte = 'AND (fecha_envio, id_mensaje) < (SELECT fecha_envio, id_mensaje FROM mensajes WHERE id_mensaje = $2)';
    }
    parametros.push(limite + 1);   // uno de más para saber si quedan mensajes anteriores
    const { rows } = await query(
        `SELECT * FROM mensajes
          WHERE id_conversacion = $1 ${corte}
          ORDER BY fecha_envio DESC, id_mensaje DESC
          LIMIT $${parametros.length}`,
        parametros
    );
    const hayMas = rows.length > limite;
    res.json({ datos: rows.slice(0, limite).reverse(), hay_mas: hayMas });
}

module.exports = {
    obtenerConversacionAutorizada, verificarPuedeEscribir, guardarMensaje,
    listarVeterinarios, listar, crear, listarMensajes,
};
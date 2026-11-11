const bcrypt = require('bcrypt');
const { query, enTransaccion, construirUpdate } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado, sinPermiso } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');
const { esPersonal } = require('../utils/acceso');

// Vista del propietario: perfil (propietarios) + datos de la cuenta (usuarios)
const SELECT_PROPIETARIO = `
    SELECT p.id_propietario, p.id_usuario, u.nombre, u.apellido, u.correo, u.activo,
           p.tipo_documento, p.numero_documento, p.telefono, p.direccion,
           p.fecha_registro, p.fecha_actualizacion
      FROM propietarios p
      JOIN usuarios u ON u.id_usuario = p.id_usuario`;

const CAMPOS_USUARIO = ['nombre', 'apellido'];

function verificarPropioOPersonal(usuario, idPropietario) {
    if (!esPersonal(usuario) && usuario.id_propietario !== idPropietario) throw sinPermiso();
}

async function buscarPropietario(idPropietario) {
    const { rows } = await query(`${SELECT_PROPIETARIO} WHERE p.id_propietario = $1`, [idPropietario]);
    if (!rows[0]) throw noEncontrado('Propietario');
    return rows[0];
}

// GET /api/propietarios?q=&activo=&pagina=&limite=
async function listar(req, res) {
    const pag = paginar(req);
    const parametros = [req.query.activo !== 'false'];
    let filtro = 'WHERE u.activo = $1';
    if (req.query.q) {
        parametros.push(`%${req.query.q}%`);
        filtro += ` AND (u.nombre ILIKE $2 OR u.apellido ILIKE $2 OR u.correo ILIKE $2 OR p.numero_documento ILIKE $2)`;
    }
    const total = (await query(
        `SELECT count(*)::int AS n FROM propietarios p JOIN usuarios u ON u.id_usuario = p.id_usuario ${filtro}`,
        parametros
    )).rows[0].n;
    const { rows } = await query(
        `SELECT x.*, (SELECT count(*)::int FROM mascotas m WHERE m.id_propietario = x.id_propietario AND m.activo) AS total_mascotas
           FROM (${SELECT_PROPIETARIO} ${filtro}) x
          ORDER BY x.apellido, x.nombre
          LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/propietarios/:id
async function obtener(req, res) {
    const id = Number(req.params.id);
    verificarPropioOPersonal(req.usuario, id);
    const propietario = await buscarPropietario(id);
    const mascotas = await query(
        `SELECT id_mascota, nombre, especie, raza, sexo, fecha_nacimiento, activo
           FROM mascotas WHERE id_propietario = $1 ORDER BY nombre`,
        [id]
    );
    res.json({ ...propietario, mascotas: mascotas.rows });
}

// GET /api/propietarios/me
async function perfil(req, res) {
    req.params.id = req.usuario.id_propietario;
    return obtener(req, res);
}

// POST /api/propietarios   (personal) registra cuenta + perfil en una transacción
async function crear(req, res) {
    const { nombre, apellido, correo, contrasena, ...perfilDatos } = req.body;
    const idPropietario = await enTransaccion(async (cliente) => {
        const hash = await bcrypt.hash(contrasena, 10);
        const usuario = await cliente.query(
            `INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
             VALUES ((SELECT id_rol FROM roles WHERE nombre = 'propietario'), $1, $2, $3, $4)
             RETURNING id_usuario`,
            [nombre, apellido, correo.toLowerCase(), hash]
        );
        // El trigger trg_usuario_perfil ya creó la fila en propietarios; se completa el perfil
        const { text, values } = construirUpdate('propietarios', 'id_usuario', usuario.rows[0].id_usuario, perfilDatos);
        const { rows } = await cliente.query(text, values);
        return rows[0].id_propietario;
    });
    res.status(201).json(await buscarPropietario(idPropietario));
}

// PUT /api/propietarios/:id   (personal, o el mismo propietario)
async function actualizar(req, res) {
    const id = Number(req.params.id);
    verificarPropioOPersonal(req.usuario, id);
    const actual = await buscarPropietario(id);

    // El propietario puede completar su documento una vez, pero no cambiarlo después
    if (!esPersonal(req.usuario) && actual.numero_documento &&
        (('numero_documento' in req.body && req.body.numero_documento !== actual.numero_documento) ||
         ('tipo_documento' in req.body && req.body.tipo_documento !== actual.tipo_documento))) {
        throw new ErrorHttp(403, 'Solo el personal de la clínica puede cambiar el documento');
    }

    const deUsuario = {};
    const dePerfil = {};
    for (const [campo, valor] of Object.entries(req.body)) {
        (CAMPOS_USUARIO.includes(campo) ? deUsuario : dePerfil)[campo] = valor;
    }
    await enTransaccion(async (cliente) => {
        if (Object.keys(deUsuario).length) {
            const q = construirUpdate('usuarios', 'id_usuario', actual.id_usuario, deUsuario);
            await cliente.query(q.text, q.values);
        }
        if (Object.keys(dePerfil).length) {
            const q = construirUpdate('propietarios', 'id_propietario', id, dePerfil);
            await cliente.query(q.text, q.values);
        }
    });
    res.json(await buscarPropietario(id));
}

// DELETE /api/propietarios/:id   (personal) -> desactiva la cuenta y sus mascotas
async function desactivar(req, res) {
    const id = Number(req.params.id);
    const actual = await buscarPropietario(id);
    if (!actual.activo) throw noEncontrado('Propietario activo');
    await enTransaccion(async (cliente) => {
        await cliente.query('UPDATE usuarios SET activo = FALSE WHERE id_usuario = $1', [actual.id_usuario]);
        await cliente.query('UPDATE mascotas SET activo = FALSE WHERE id_propietario = $1', [id]);
    });
    res.status(204).end();
}

// GET /api/propietarios/:id/mascotas
async function mascotas(req, res) {
    const id = Number(req.params.id);
    verificarPropioOPersonal(req.usuario, id);
    await buscarPropietario(id);
    const { rows } = await query(
        `SELECT m.*, h.id_historia, h.numero AS numero_historia
           FROM mascotas m LEFT JOIN historias_clinicas h ON h.id_mascota = m.id_mascota
          WHERE m.id_propietario = $1 AND m.activo ORDER BY m.nombre`,
        [id]
    );
    res.json(rows);
}

module.exports = { listar, obtener, perfil, crear, actualizar, desactivar, mascotas };

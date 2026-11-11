const { query, construirInsert, construirUpdate } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');
const { esPersonal, obtenerMascotaAutorizada } = require('../utils/acceso');

async function verificarPropietarioActivo(idPropietario) {
    const { rows } = await query(
        `SELECT u.activo FROM propietarios p JOIN usuarios u ON u.id_usuario = p.id_usuario
          WHERE p.id_propietario = $1`,
        [idPropietario]
    );
    if (!rows[0]) throw new ErrorHttp(400, 'El propietario indicado no existe');
    if (!rows[0].activo) throw new ErrorHttp(400, 'El propietario indicado está desactivado');
}

async function historiaDe(idMascota) {
    const { rows } = await query('SELECT id_historia, numero FROM historias_clinicas WHERE id_mascota = $1', [idMascota]);
    return rows[0] || null;
}

// GET /api/mascotas?q=&especie=&id_propietario=&activo=&pagina=&limite=
async function listar(req, res) {
    const pag = paginar(req);
    const parametros = [];
    const condiciones = [];
    // "?" se reemplaza por el número de parámetro ($n) del valor agregado
    const agregar = (sql, valor) => {
        parametros.push(valor);
        condiciones.push(sql.replaceAll('?', `$${parametros.length}`));
    };

    if (!esPersonal(req.usuario)) agregar('m.id_propietario = ?', req.usuario.id_propietario);
    else if (req.query.id_propietario) agregar('m.id_propietario = ?', Number(req.query.id_propietario));
    if (req.query.especie) agregar('m.especie = ?', String(req.query.especie).toLowerCase());
    if (req.query.q) agregar('(m.nombre ILIKE ? OR m.microchip ILIKE ?)', `%${req.query.q}%`);
    agregar('m.activo = ?', req.query.activo !== 'false');

    const filtro = `WHERE ${condiciones.join(' AND ')}`;
    const total = (await query(`SELECT count(*)::int AS n FROM mascotas m ${filtro}`, parametros)).rows[0].n;
    const { rows } = await query(
        `SELECT m.*, u.nombre || ' ' || u.apellido AS nombre_propietario,
                h.id_historia, h.numero AS numero_historia
           FROM mascotas m
           JOIN propietarios p ON p.id_propietario = m.id_propietario
           JOIN usuarios u ON u.id_usuario = p.id_usuario
           LEFT JOIN historias_clinicas h ON h.id_mascota = m.id_mascota
           ${filtro}
          ORDER BY m.nombre
          LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/mascotas/:id
async function obtener(req, res) {
    const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
    const { rows } = await query(
        `SELECT p.id_propietario, u.nombre, u.apellido, u.correo, p.telefono
           FROM propietarios p JOIN usuarios u ON u.id_usuario = p.id_usuario
          WHERE p.id_propietario = $1`,
        [mascota.id_propietario]
    );
    res.json({ ...mascota, propietario: rows[0], historia: await historiaDe(mascota.id_mascota) });
}

// POST /api/mascotas   (personal, o propietario a su nombre)
async function crear(req, res) {
    const datos = { ...req.body };
    if (!esPersonal(req.usuario)) datos.id_propietario = req.usuario.id_propietario;
    await verificarPropietarioActivo(datos.id_propietario);

    const { text, values } = construirInsert('mascotas', datos);
    const { rows } = await query(text, values);
    // La historia clínica la crea el trigger trg_mascota_historia
    res.status(201).json({ ...rows[0], historia: await historiaDe(rows[0].id_mascota) });
}

// PUT /api/mascotas/:id
async function actualizar(req, res) {
    const id = Number(req.params.id);
    await obtenerMascotaAutorizada(id, req.usuario);
    if ('id_propietario' in req.body) {
        if (!esPersonal(req.usuario)) throw new ErrorHttp(403, 'Solo el personal de la clínica puede cambiar el propietario');
        await verificarPropietarioActivo(req.body.id_propietario);
    }
    const { text, values } = construirUpdate('mascotas', 'id_mascota', id, req.body);
    const { rows } = await query(text, values);
    res.json(rows[0]);
}

// DELETE /api/mascotas/:id   (personal) -> borrado lógico; la historia se conserva
async function desactivar(req, res) {
    const { rowCount } = await query(
        'UPDATE mascotas SET activo = FALSE WHERE id_mascota = $1 AND activo',
        [Number(req.params.id)]
    );
    if (!rowCount) throw noEncontrado('Mascota activa');
    res.status(204).end();
}

module.exports = { listar, obtener, crear, actualizar, desactivar };

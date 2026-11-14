const bcrypt = require('bcrypt');
const { query, enTransaccion, construirInsert, construirUpdate } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');

// Vista del veterinario: perfil (veterinarios) + datos de la cuenta (usuarios)
const SELECT_VETERINARIO = `
    SELECT v.id_veterinario, v.id_usuario, u.nombre, u.apellido, u.correo, u.activo,
           v.tarjeta_profesional, v.especialidad, v.telefono,
           v.fecha_registro, v.fecha_actualizacion
      FROM veterinarios v
      JOIN usuarios u ON u.id_usuario = v.id_usuario`;

const CAMPOS_USUARIO = ['nombre', 'apellido'];

async function buscarVeterinario(idVeterinario) {
    const { rows } = await query(`${SELECT_VETERINARIO} WHERE v.id_veterinario = $1`, [idVeterinario]);
    if (!rows[0]) throw noEncontrado('Veterinario');
    return rows[0];
}

async function verificarTarjetaLibre(tarjetaProfesional, idVeterinarioExcluir = null) {
    const parametros = idVeterinarioExcluir
        ? [tarjetaProfesional, idVeterinarioExcluir]
        : [tarjetaProfesional];
    const filtroExcluir = idVeterinarioExcluir ? 'AND id_veterinario <> $2' : '';
    const { rows } = await query(
        `SELECT id_veterinario FROM veterinarios WHERE tarjeta_profesional = $1 ${filtroExcluir}`,
        parametros
    );
    if (rows.length > 0) {
        throw new ErrorHttp(409, 'Ya existe un veterinario con esa tarjeta profesional');
    }
}

// GET /api/veterinarios?q=&especialidad=&activo=&pagina=&limite=
async function listar(req, res) {
    const pag = paginar(req);
    const parametros = [req.query.activo !== 'false'];
    let filtro = 'WHERE u.activo = $1';
    if (req.query.especialidad) {
        parametros.push(req.query.especialidad);
        filtro += ` AND v.especialidad = $${parametros.length}`;
    }
    if (req.query.q) {
        parametros.push(`%${req.query.q}%`);
        filtro += ` AND (u.nombre ILIKE $${parametros.length} OR u.apellido ILIKE $${parametros.length}
                     OR v.tarjeta_profesional ILIKE $${parametros.length})`;
    }
    const total = (await query(
        `SELECT count(*)::int AS n FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario ${filtro}`,
        parametros
    )).rows[0].n;
    const { rows } = await query(
        `${SELECT_VETERINARIO} ${filtro}
          ORDER BY u.apellido, u.nombre
          LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/veterinarios/:id
async function obtener(req, res) {
    res.json(await buscarVeterinario(Number(req.params.id)));
}

// POST /api/veterinarios   (admin) crea cuenta + perfil en una transacción
async function crear(req, res) {
    const { nombre, apellido, correo, contrasena, tarjeta_profesional, especialidad, telefono } = req.body;

    await verificarTarjetaLibre(tarjeta_profesional);

    const idVeterinario = await enTransaccion(async (cliente) => {
        const hash = await bcrypt.hash(contrasena, 10);
        const usuario = await cliente.query(
            `INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
             VALUES ((SELECT id_rol FROM roles WHERE nombre = 'veterinario'), $1, $2, $3, $4)
             RETURNING id_usuario`,
            [nombre, apellido, correo.toLowerCase(), hash]
        );
        // El trigger trg_usuario_perfil ya creó la fila en veterinarios; se completa el perfil
        const { text, values } = construirUpdate(
            'veterinarios',
            'id_usuario',
            usuario.rows[0].id_usuario,
            { tarjeta_profesional, especialidad, telefono }
        );
        const { rows } = await cliente.query(text, values);
        return rows[0].id_veterinario;
    });

    res.status(201).json(await buscarVeterinario(idVeterinario));
}

// PUT /api/veterinarios/:id   (admin)
async function actualizar(req, res) {
    const id = Number(req.params.id);
    const actual = await buscarVeterinario(id);

    if ('tarjeta_profesional' in req.body && req.body.tarjeta_profesional !== actual.tarjeta_profesional) {
        await verificarTarjetaLibre(req.body.tarjeta_profesional, id);
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
            const q = construirUpdate('veterinarios', 'id_veterinario', id, dePerfil);
            await cliente.query(q.text, q.values);
        }
    });
    res.json(await buscarVeterinario(id));
}

// DELETE /api/veterinarios/:id   (admin) -> desactiva la cuenta; su historial se conserva
async function desactivar(req, res) {
    const id = Number(req.params.id);
    const actual = await buscarVeterinario(id);
    if (!actual.activo) throw noEncontrado('Veterinario activo');
    await query('UPDATE usuarios SET activo = FALSE WHERE id_usuario = $1', [actual.id_usuario]);
    res.status(204).end();
}

// ---------- Horarios de atención ----------

// GET /api/veterinarios/:id/horarios
async function listarHorarios(req, res) {
    await buscarVeterinario(Number(req.params.id));
    const { rows } = await query(
        `SELECT id_horario, dia_semana, hora_inicio, hora_fin
           FROM horarios_veterinario
          WHERE id_veterinario = $1
          ORDER BY dia_semana, hora_inicio`,
        [Number(req.params.id)]
    );
    res.json(rows);
}

// POST /api/veterinarios/:id/horarios
async function crearHorario(req, res) {
    await buscarVeterinario(Number(req.params.id));
    const { text, values } = construirInsert('horarios_veterinario', {
        id_veterinario: Number(req.params.id),
        ...req.body,
    });
    const { rows } = await query(text, values);
    res.status(201).json(rows[0]);
}

// PUT /api/veterinarios/:id/horarios/:idHorario
async function actualizarHorario(req, res) {
    // Se confirma que el horario pertenezca a ESTE veterinario antes de modificarlo
    const { rows: existe } = await query(
        'SELECT 1 FROM horarios_veterinario WHERE id_horario = $1 AND id_veterinario = $2',
        [Number(req.params.idHorario), Number(req.params.id)]
    );
    if (!existe[0]) throw noEncontrado('Horario');

    const { text, values } = construirUpdate(
        'horarios_veterinario',
        'id_horario',
        Number(req.params.idHorario),
        req.body
    );
    const { rows } = await query(text, values);
    res.json(rows[0]);
}

// DELETE /api/veterinarios/:id/horarios/:idHorario
async function eliminarHorario(req, res) {
    const { rowCount } = await query(
        'DELETE FROM horarios_veterinario WHERE id_horario = $1 AND id_veterinario = $2',
        [Number(req.params.idHorario), Number(req.params.id)]
    );
    if (!rowCount) throw noEncontrado('Horario');
    res.status(204).end();
}

module.exports = {
    listar,
    obtener,
    crear,
    actualizar,
    desactivar,
    listarHorarios,
    crearHorario,
    actualizarHorario,
    eliminarHorario,
};

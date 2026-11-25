// Ep4-Hu3: seguimiento de la evolución de la mascota (peso y observaciones a lo largo del tiempo)
const { query, enTransaccion } = require('../utils/baseDatos');
const { ErrorHttp } = require('../utils/errores');
const { obtenerMascotaAutorizada } = require('../utils/acceso');

// Un registro de seguimiento + quién lo registró y con qué rol
const SELECT_SEGUIMIENTO = `SELECT s.id_seguimiento, s.id_mascota, s.fecha, s.peso_kg, s.observaciones,
        s.fecha_registro, s.id_usuario,
        u.nombre || ' ' || u.apellido AS registrado_por, r.nombre AS rol_registrador
   FROM seguimiento_peso s
   JOIN usuarios u ON u.id_usuario = s.id_usuario
   JOIN roles r ON r.id_rol = u.id_rol`;

// GET /api/mascotas/:id/seguimiento
// Todos los registros de la mascota, del más reciente al más antiguo.
// El propietario solo ve los de sus mascotas (403 si es de otro); el personal ve todos.
async function listar(req, res) {
    const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
    const { rows } = await query(
        `${SELECT_SEGUIMIENTO} WHERE s.id_mascota = $1 ORDER BY s.fecha DESC, s.id_seguimiento DESC`,
        [mascota.id_mascota]
    );
    res.json({
        mascota: { id_mascota: mascota.id_mascota, nombre: mascota.nombre, especie: mascota.especie, peso_kg: mascota.peso_kg },
        datos: rows,
    });
}

// POST /api/mascotas/:id/seguimiento   { peso_kg, fecha?, observaciones? }
// Lo registran el veterinario, el administrador o el propietario de la mascota.
async function registrar(req, res) {
    const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
    const { peso_kg, observaciones } = req.body;

    const hoy = (await query('SELECT CURRENT_DATE AS hoy')).rows[0].hoy; // 'AAAA-MM-DD'
    const fecha = req.body.fecha ?? hoy;
    if (fecha > hoy) {
        throw new ErrorHttp(400, 'Datos inválidos', [{ campo: 'fecha', mensaje: 'La fecha no puede ser futura' }]);
    }

    const idSeguimiento = await enTransaccion(async (cliente) => {
        const { rows } = await cliente.query(
            `INSERT INTO seguimiento_peso (id_mascota, id_usuario, fecha, peso_kg, observaciones)
             VALUES ($1, $2, $3, $4, $5) RETURNING id_seguimiento`,
            [mascota.id_mascota, req.usuario.id_usuario, fecha, peso_kg, observaciones || null]
        );
        // El peso actual de la mascota es el del registro más reciente
        await cliente.query(
            `UPDATE mascotas SET peso_kg = (
                SELECT peso_kg FROM seguimiento_peso WHERE id_mascota = $1
                 ORDER BY fecha DESC, id_seguimiento DESC LIMIT 1)
             WHERE id_mascota = $1`,
            [mascota.id_mascota]
        );
        return rows[0].id_seguimiento;
    });

    const { rows } = await query(`${SELECT_SEGUIMIENTO} WHERE s.id_seguimiento = $1`, [idSeguimiento]);
    res.status(201).json(rows[0]);
}

module.exports = { listar, registrar };

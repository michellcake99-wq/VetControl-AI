// Ep4-Hu4: «Mi perfil». Cada usuario ve y edita únicamente su propio perfil (siempre se usa el id del token).
const bcrypt = require('bcrypt');
const { query, enTransaccion, construirUpdate } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado } = require('../utils/errores');

const SELECT_PERFIL = {
    propietario: `SELECT u.id_usuario, r.nombre AS rol, u.nombre, u.apellido, u.correo,
                         p.telefono, p.tipo_documento, p.numero_documento, p.direccion
                    FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
                    JOIN propietarios p ON p.id_usuario = u.id_usuario WHERE u.id_usuario = $1`,
    veterinario: `SELECT u.id_usuario, r.nombre AS rol, u.nombre, u.apellido, u.correo,
                         v.telefono, v.tarjeta_profesional, v.especialidad
                    FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
                    JOIN veterinarios v ON v.id_usuario = u.id_usuario WHERE u.id_usuario = $1`,
    administrador: `SELECT u.id_usuario, r.nombre AS rol, u.nombre, u.apellido, u.correo
                      FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE u.id_usuario = $1`,
};

// Qué columnas son de la cuenta (usuarios) y cuáles del perfil de cada rol
const TABLA_PERFIL = {
    propietario: { tabla: 'propietarios', id: 'id_propietario', campos: ['telefono', 'direccion', 'tipo_documento', 'numero_documento'] },
    veterinario: { tabla: 'veterinarios', id: 'id_veterinario', campos: ['telefono', 'especialidad', 'tarjeta_profesional'] },
};
// Datos de identidad que se completan una vez; después solo los cambia el personal de la clínica
const IDENTIDAD = {
    propietario: ['tipo_documento', 'numero_documento'],
    veterinario: ['tarjeta_profesional'],
};

async function leerPerfil(usuario) {
    const { rows } = await query(SELECT_PERFIL[usuario.rol], [usuario.id_usuario]);
    if (!rows[0]) throw noEncontrado('Perfil');
    return rows[0];
}

// GET /api/perfil
async function obtener(req, res) {
    res.json(await leerPerfil(req.usuario));
}

// PUT /api/perfil  — nombre y apellido para todos; teléfono, dirección y documento (propietario);
// teléfono, especialidad y tarjeta profesional (veterinario). El correo y el rol no se pueden cambiar.
async function actualizar(req, res) {
    const usuario = req.usuario;
    const { rol, id_usuario: idUsuario } = usuario;
    const actual = await leerPerfil(usuario);

    // Documento / tarjeta profesional: solo se pueden completar si están vacíos
    for (const campo of IDENTIDAD[rol] ?? []) {
        if (campo in req.body && actual[campo] && req.body[campo] !== actual[campo]) {
            throw new ErrorHttp(403, 'Este dato ya está registrado y solo lo puede cambiar el personal de la clínica', [
                { campo, mensaje: 'No se puede modificar' },
            ]);
        }
    }

    const deCuenta = {};
    const dePerfil = {};
    for (const [campo, valor] of Object.entries(req.body)) {
        (['nombre', 'apellido'].includes(campo) ? deCuenta : dePerfil)[campo] = valor;
    }
    await enTransaccion(async (cliente) => {
        if (Object.keys(deCuenta).length) {
            const q = construirUpdate('usuarios', 'id_usuario', idUsuario, deCuenta);
            await cliente.query(q.text, q.values);
        }
        if (Object.keys(dePerfil).length) {
            const { tabla } = TABLA_PERFIL[rol];
            const q = construirUpdate(tabla, 'id_usuario', idUsuario, dePerfil);
            await cliente.query(q.text, q.values);
        }
    });
    res.json(await leerPerfil(usuario));
}

// PUT /api/perfil/contrasena  { contrasena_actual, contrasena_nueva, confirmacion }
// Los errores de la contraseña actual responden 400 (no 401) para que la sesión no se cierre.
async function cambiarContrasena(req, res) {
    const { contrasena_actual: actual, contrasena_nueva: nueva } = req.body;
    const { rows } = await query('SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1', [req.usuario.id_usuario]);
    if (!(await bcrypt.compare(actual, rows[0].contrasena_hash))) {
        throw new ErrorHttp(400, 'Datos inválidos', [{ campo: 'contrasena_actual', mensaje: 'La contraseña actual es incorrecta' }]);
    }
    await query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [
        await bcrypt.hash(nueva, 10),
        req.usuario.id_usuario,
    ]);
    res.json({ mensaje: 'Tu contraseña se actualizó correctamente.' });
}

module.exports = { obtener, actualizar, cambiarContrasena };

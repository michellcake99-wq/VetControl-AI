const { query, contextoUsuario } = require('../utils/baseDatos');
const { ErrorHttp } = require('../utils/errores');

/**
 * Se usa DESPUÉS de verificarToken (authMiddleware.js).
 * Completa req.usuario con id_propietario / id_veterinario y verifica
 * que la cuenta siga activa (el token puede seguir vigente aunque se desactive).
 */
async function cargarPerfil(req, _res, next) {
    const { rows } = await query(
        `SELECT u.activo, r.nombre AS rol, p.id_propietario, v.id_veterinario
           FROM usuarios u
           JOIN roles r ON r.id_rol = u.id_rol
           LEFT JOIN propietarios p ON p.id_usuario = u.id_usuario
           LEFT JOIN veterinarios v ON v.id_usuario = u.id_usuario
          WHERE u.id_usuario = $1`,
        [req.usuario.id_usuario]
    );
    const perfil = rows[0];
    if (!perfil || !perfil.activo) throw new ErrorHttp(401, 'La cuenta no existe o está desactivada');

    req.usuario = {
        ...req.usuario,
        rol: perfil.rol,
        id_propietario: perfil.id_propietario,
        id_veterinario: perfil.id_veterinario,
    };
    // Todo lo que se ejecute en esta petición queda asociado a este usuario (auditoría)
    contextoUsuario.run({ id_usuario: req.usuario.id_usuario }, next);
}

/** Restringe la ruta a uno o varios roles. */
const permitirRoles = (...roles) => (req, _res, next) => {
    if (!roles.includes(req.usuario.rol)) throw new ErrorHttp(403, 'Su rol no tiene permiso para esta acción');
    next();
};

module.exports = { cargarPerfil, permitirRoles };

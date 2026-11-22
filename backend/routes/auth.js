const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const recuperacion = require('../controllers/recuperacionController');

const router = express.Router();

// Ep7-Hu3: bloqueo tras 5 intentos fallidos en 15 minutos
const MAX_INTENTOS = 5;
const VENTANA_MIN = 15;

/** Minutos que faltan para poder intentar de nuevo (0 si el correo no está bloqueado). */
async function minutosDeBloqueo(correo) {
    const { rows } = await pool.query(
        `SELECT fecha FROM intentos_login
          WHERE correo = $1 AND fecha > now() - make_interval(mins => $2)
          ORDER BY fecha DESC LIMIT $3`,
        [correo, VENTANA_MIN, MAX_INTENTOS]
    );
    if (rows.length < MAX_INTENTOS) return 0;
    // El bloqueo dura hasta 15 minutos después del intento que lo causó (el quinto, el más antiguo de los cinco)
    const hasta = new Date(rows[MAX_INTENTOS - 1].fecha).getTime() + VENTANA_MIN * 60000;
    return Math.max(1, Math.ceil((hasta - Date.now()) / 60000));
}

const respuestaBloqueo = (res, minutos) =>
    res.status(429).json({
        mensaje: `Demasiados intentos fallidos. Por seguridad, el acceso quedó bloqueado temporalmente. `
            + `Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
        codigo: 'cuenta_bloqueada',
        reintentar_en_minutos: minutos,
    });

/** Guarda un intento fallido. Si con este se llega al límite, responde el bloqueo; si no, el error normal. */
async function intentoFallido(res, correo) {
    await pool.query('INSERT INTO intentos_login (correo) VALUES ($1)', [correo]);
    await pool.query("DELETE FROM intentos_login WHERE fecha < now() - interval '1 day'");
    const minutos = await minutosDeBloqueo(correo);
    if (minutos) return respuestaBloqueo(res, minutos);
    return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
}

// Roles que se pueden elegir al registrarse desde la plataforma.
// El rol "administrador" no se puede crear desde el registro público.
const ROLES_PUBLICOS = ['propietario', 'veterinario'];

// Registrar usuario
router.post('/register', async (req, res) => {
    try {
        const { nombre, apellido, correo, contrasena, rol = 'propietario' } = req.body;

        // Verificar campos obligatorios
        if (!nombre || !apellido || !correo || !contrasena) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        // Verificar que el rol sea permitido
        if (!ROLES_PUBLICOS.includes(rol)) {
            return res.status(403).json({
                mensaje: 'Rol no permitido para el registro'
            });
        }

        // Verificar si el correo ya está registrado
        const usuarioExistente = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE correo = $1',
            [correo]
        );

        if (usuarioExistente.rows.length > 0) {
            return res.status(409).json({
                mensaje: 'El correo ya está registrado'
            });
        }

        // Buscar el id del rol en la tabla roles
        const rolEncontrado = await pool.query(
            'SELECT id_rol FROM roles WHERE nombre = $1',
            [rol]
        );

        if (rolEncontrado.rows.length === 0) {
            return res.status(400).json({
                mensaje: 'El rol indicado no existe'
            });
        }

        // Encriptar contraseña
        const contrasenaEncriptada = await bcrypt.hash(contrasena, 10);

        // Insertar usuario
        const resultado = await pool.query(
            `INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id_usuario, nombre, apellido, correo, fecha_registro`,
            [rolEncontrado.rows[0].id_rol, nombre, apellido, correo, contrasenaEncriptada]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: { ...resultado.rows[0], rol }
        });

    } catch (error) {
        console.error('Error al registrar usuario:', error);

        res.status(500).json({
            mensaje: 'Error interno del servidor'
        });
    }
});

// Iniciar sesión
router.post('/login', async (req, res) => {
    try {
        const { correo, contrasena } = req.body;

        // Verificar campos obligatorios
        if (!correo || !contrasena) {
            return res.status(400).json({
                mensaje: 'El correo y la contraseña son obligatorios'
            });
        }

        // Ep7-Hu3: si el correo está bloqueado, ni siquiera se revisa la contraseña
        const clave = String(correo).trim().toLowerCase();
        const bloqueo = await minutosDeBloqueo(clave);
        if (bloqueo) return respuestaBloqueo(res, bloqueo);

        // Buscar usuario por correo (junto con el nombre de su rol)
        const resultado = await pool.query(
            `SELECT u.*, r.nombre AS rol
             FROM usuarios u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.correo = $1`,
            [correo]
        );

        if (resultado.rows.length === 0) {
            return intentoFallido(res, clave);
        }

        const usuario = resultado.rows[0];

        // Comparar contraseña ingresada con la contraseña encriptada
        const contraseñaValida = await bcrypt.compare(
            contrasena,
            usuario.contrasena_hash
        );

        if (!contraseñaValida) {
            return intentoFallido(res, clave);
        }

        // Inicio de sesión correcto: se borran los intentos fallidos de este correo
        await pool.query('DELETE FROM intentos_login WHERE correo = $1', [clave]);

        // Verificar que la cuenta esté activa
        if (!usuario.activo) {
            return res.status(403).json({
                mensaje: 'La cuenta está desactivada'
            });
        }

        // Generar token JWT
        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);

        res.status(500).json({
            mensaje: 'Error interno del servidor'
        });
    }
});

// Ep7-Hu4: recuperación de contraseña
router.post('/olvide-contrasena', validar(esquemas.olvideContrasena), recuperacion.solicitar);
router.post('/verificar-token-recuperacion', validar(esquemas.verificarTokenRecuperacion), recuperacion.verificar);
router.post('/restablecer-contrasena', validar(esquemas.restablecerContrasena), recuperacion.restablecer);

module.exports = router;
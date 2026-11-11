const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

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

        // Buscar usuario por correo (junto con el nombre de su rol)
        const resultado = await pool.query(
            `SELECT u.*, r.nombre AS rol
             FROM usuarios u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.correo = $1`,
            [correo]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        const usuario = resultado.rows[0];

        // Comparar contraseña ingresada con la contraseña encriptada
        const contraseñaValida = await bcrypt.compare(
            contrasena,
            usuario.contrasena_hash
        );

        if (!contraseñaValida) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

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

module.exports = router;
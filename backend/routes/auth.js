const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// Registrar usuario
router.post('/register', async (req, res) => {
    try {
        const { nombre, correo, contrasena, rol } = req.body;

        // Verificar campos obligatorios
        if (!nombre || !correo || !contrasena || !rol) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
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

        // Encriptar contraseña
        const contrasenaEncriptada = await bcrypt.hash(contrasena, 10);

        // Insertar usuario
        const resultado = await pool.query(
            `INSERT INTO usuarios (nombre, correo, contrasena, rol)
             VALUES ($1, $2, $3, $4)
             RETURNING id_usuario, nombre, correo, rol, fecha_registro`,
            [nombre, correo, contrasenaEncriptada, rol]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente',
            usuario: resultado.rows[0]
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

        // Buscar usuario por correo
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE correo = $1',
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
            usuario.contrasena
        );

        if (!contraseñaValida) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
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
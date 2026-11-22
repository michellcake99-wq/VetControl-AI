const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/perfilController');

// /api/perfil   (Ep4-Hu4) — cualquier rol; solo trabaja con el perfil del usuario del token
const router = express.Router();
router.use(verificarToken, cargarPerfil);

// El esquema depende del rol: cada uno edita solo sus propios campos
const validarPerfil = (req, res, next) => validar(esquemas.perfilActualizar[req.usuario.rol])(req, res, next);

router.get('/', c.obtener);
router.put('/', validarPerfil, c.actualizar);
router.put('/contrasena', validar(esquemas.perfilContrasena), c.cambiarContrasena);

module.exports = router;

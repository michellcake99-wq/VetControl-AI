const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/conversacionesController');

// Ep8: chat propietario <-> veterinario. El envío y la recepción de mensajes en tiempo real están en sockets/chat.js
const router = express.Router();
const id = validar(esquemas.parametroId, 'params');

// Ep8-Hu5: el chat es solo entre propietario y veterinario (el administrador recibe 403)
router.use(verificarToken, cargarPerfil, permitirRoles('propietario', 'veterinario'));

router.get('/veterinarios', permitirRoles('propietario'), c.listarVeterinarios);
router.get('/', c.listar);
router.post('/', permitirRoles('propietario'), validar(esquemas.conversacionCrear), c.crear);
router.get('/:id/mensajes', id, c.listarMensajes);
router.put('/:id/leidos', id, c.marcarLeidos);

module.exports = router;

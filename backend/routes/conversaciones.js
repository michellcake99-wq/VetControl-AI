const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/conversacionesController');

// Ep8: chat propietario <-> veterinario. El envío de mensajes en tiempo real está en sockets/chat.js
const router = express.Router();
const id = validar(esquemas.parametroId, 'params');

router.use(verificarToken, cargarPerfil);

router.get('/veterinarios', c.listarVeterinarios);
router.get('/', c.listar);
router.post('/', permitirRoles('propietario'), validar(esquemas.conversacionCrear), c.crear);
router.get('/:id/mensajes', id, c.listarMensajes);
router.put('/:id/leidos', id, c.marcarLeidos);

module.exports = router;

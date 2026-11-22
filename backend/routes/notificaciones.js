const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/notificacionesController');

const router = express.Router();

// Cada usuario solo ve y marca sus propias notificaciones
router.use(verificarToken, cargarPerfil);

router.get('/', c.listar);
router.get('/no-leidas', c.contarNoLeidas);
router.post('/marcar-leidas', c.marcarTodasLeidas);
router.patch('/:id/leida', validar(esquemas.parametroId, 'params'), c.marcarLeida);

module.exports = router;
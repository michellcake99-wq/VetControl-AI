const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const esquemasCitas = require('../validators/citasEsquemas');
const c = require('../controllers/citasController');

const router = express.Router();
const id = validar(esquemas.parametroId, 'params');

// Todas las rutas exigen un token JWT válido (Ep3-Hu10)
router.use(verificarToken, cargarPerfil);

router.get('/', validar(esquemasCitas.citaListado, 'query'), c.listar);
router.post('/', validar(esquemasCitas.citaCrear), c.crear);
router.get('/:id', id, c.obtener);
router.put('/:id/estado', id, validar(esquemasCitas.citaEstado), c.cambiarEstado);
router.patch('/:id/estado', id, validar(esquemasCitas.citaEstado), c.cambiarEstado);

module.exports = router;

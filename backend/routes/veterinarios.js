const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/veterinariosController');

const router = express.Router();
const soloAdmin = permitirRoles('administrador');

// Ep7-Hu1: todo este recurso es exclusivo del administrador
router.use(verificarToken, cargarPerfil, soloAdmin);

router.get('/', c.listar);
router.post('/', validar(esquemas.veterinarioCrear), c.crear);
router.get('/:id', c.obtener);
router.put('/:id', validar(esquemas.veterinarioActualizar), c.actualizar);
router.delete('/:id', c.desactivar);

// Días y horas de atención (Ep4-Hu5)
router.get('/:id/horarios', c.listarHorarios);
router.post('/:id/horarios', validar(esquemas.horarioCrear), c.crearHorario);
router.put('/:id/horarios/:idHorario', validar(esquemas.horarioActualizar), c.actualizarHorario);
router.delete('/:id/horarios/:idHorario', c.eliminarHorario);

module.exports = router;

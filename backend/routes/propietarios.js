const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/propietariosController');

const router = express.Router();
const id = validar(esquemas.parametroId, 'params');
const personal = permitirRoles('veterinario', 'administrador');

router.use(verificarToken, cargarPerfil);

router.get('/', personal, c.listar);
router.get('/me', permitirRoles('propietario'), c.perfil);
router.post('/', personal, validar(esquemas.propietarioCrear), c.crear);
router.get('/:id', id, c.obtener);
router.put('/:id', id, validar(esquemas.propietarioActualizar), c.actualizar);
router.delete('/:id', personal, id, c.desactivar);
router.get('/:id/mascotas', id, c.mascotas);

module.exports = router;

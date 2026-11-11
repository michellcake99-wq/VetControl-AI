const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/mascotasController');

const router = express.Router();
const id = validar(esquemas.parametroId, 'params');

router.use(verificarToken, cargarPerfil);

router.get('/', c.listar);
router.post('/', (req, _res, next) => {
    // El propietario registra mascotas a su nombre; no necesita enviar id_propietario
    if (req.usuario.rol === 'propietario') req.body = { ...req.body, id_propietario: req.usuario.id_propietario };
    next();
}, validar(esquemas.mascotaCrear), c.crear);
router.get('/:id', id, c.obtener);
router.put('/:id', id, validar(esquemas.mascotaActualizar), c.actualizar);
router.delete('/:id', permitirRoles('veterinario', 'administrador'), id, c.desactivar);


module.exports = router;

const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/mascotasController');
const h = require('../controllers/historiasController');
const cm = require('../controllers/consultasMascotaController');
const sg = require('../controllers/seguimientoController');

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

// Hu8: historia clínica desde la mascota
router.get('/:id/historia', id, h.obtenerPorMascota);

// Hu9: consultas y tratamientos de la mascota
router.get('/:id/consultas', id, cm.listarConsultas);
router.get('/:id/tratamientos', id, cm.listarTratamientos);

// Ep4-Hu2: historial médico cronológico (consultas, tratamientos y vacunas; solo lectura)
router.get('/:id/historial', id, cm.historial);

// Ep4-Hu3: seguimiento de la evolución (peso y observaciones). Lo ven y lo registran el personal
// y el propietario de la mascota; queda guardado quién lo registró.
router.get('/:id/seguimiento', id, sg.listar);
router.post('/:id/seguimiento', id, validar(esquemas.seguimientoCrear), sg.registrar);

module.exports = router;
const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/iaController');

// /api/ia   (Ep6-Hu1) — exige token JWT válido (cualquier rol)
const router = express.Router();
router.use(verificarToken, cargarPerfil);
// Ep6-Hu5: consultas que le quedan al usuario
router.get('/cupo', c.cupo);
router.post('/consultar', validar(esquemas.iaConsultar), c.consultar);
// Ep6-Hu2: resumen de la historia clínica de una mascota
router.post('/resumir-historial', validar(esquemas.iaResumir), c.resumirHistorial);
// Ep6-Hu3: sugerencia de IA para un pendiente (solo personal veterinario).
router.post('/sugerir-pendiente', permitirRoles('veterinario', 'administrador'), validar(esquemas.iaSugerirPendiente), c.sugerirPendiente);

module.exports = router;
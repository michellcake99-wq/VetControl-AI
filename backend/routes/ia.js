const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const c = require('../controllers/iaController');

// /api/ia   (Ep6-Hu1) — exige token JWT válido (cualquier rol)
const router = express.Router();
router.use(verificarToken, cargarPerfil);
router.post('/consultar', validar(esquemas.iaConsultar), c.consultar);
// Ep6-Hu2: resumen de la historia clínica de una mascota
router.post('/resumir-historial', validar(esquemas.iaResumir), c.resumirHistorial);

module.exports = router;
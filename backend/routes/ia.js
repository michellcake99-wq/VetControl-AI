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

module.exports = router;

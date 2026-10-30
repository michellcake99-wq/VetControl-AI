const express = require('express');
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Ruta protegida de prueba
router.get('/perfil', verificarToken, (req, res) => {
    res.json({
        mensaje: 'Acceso autorizado',
        usuario: req.usuario
    });
});

module.exports = router;
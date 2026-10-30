const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Verificar que exista el encabezado Authorization
        if (!authHeader) {
            return res.status(401).json({
                mensaje: 'Token de acceso requerido'
            });
        }

        // Verificar formato: Bearer TOKEN
        const partes = authHeader.split(' ');

        if (partes.length !== 2 || partes[0] !== 'Bearer') {
            return res.status(401).json({
                mensaje: 'Formato de token inválido'
            });
        }

        const token = partes[1];

        // Verificar el token
        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Guardar información del usuario en la petición
        req.usuario = usuario;

        next();

    } catch (error) {
        return res.status(401).json({
            mensaje: 'Token inválido o expirado'
        });
    }
};

module.exports = verificarToken;
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
        // Ep7-Hu3: el token dura 2 horas; al vencer, el cliente muestra el mensaje y lleva al inicio de sesión
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                mensaje: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
                codigo: 'sesion_expirada'
            });
        }
        return res.status(401).json({
            mensaje: 'Token inválido o expirado'
        });
    }
};

module.exports = verificarToken;
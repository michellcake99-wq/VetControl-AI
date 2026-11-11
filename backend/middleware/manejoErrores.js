const { ErrorHttp } = require('../utils/errores');

// Traduce errores de PostgreSQL a respuestas entendibles
const ERRORES_PG = {
    23505: [409, 'Ya existe un registro con ese valor (dato único repetido)'],
    23503: [409, 'El registro está relacionado con otros datos o la referencia no existe'],
    23514: [400, 'Un valor no cumple las reglas de validación'],
    '23P01': [409, 'El dato se cruza con otro registro existente'],
    '22P02': [400, 'Formato de dato inválido'],
    22007: [400, 'Formato de fecha inválido'],
    22008: [400, 'Fecha fuera de rango'],
};

// eslint-disable-next-line no-unused-vars
function manejoErrores(error, _req, res, _next) {
    if (error instanceof ErrorHttp) {
        return res.status(error.estado).json({ mensaje: error.message, ...(error.detalles && { detalles: error.detalles }) });
    }
    if (error.code && ERRORES_PG[error.code]) {
        const [estado, mensaje] = ERRORES_PG[error.code];
        return res.status(estado).json({ mensaje, ...(error.detail && { detalle: error.detail }) });
    }
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ mensaje: 'JSON mal formado' });
    }
    console.error(error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
}

module.exports = manejoErrores;

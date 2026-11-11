const { ErrorHttp } = require('../utils/errores');

/** Valida req[origen] con un esquema de zod y deja los datos limpios. */
const validar = (esquema, origen = 'body') => (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen] ?? {});
    if (!resultado.success) {
        const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
        throw new ErrorHttp(400, 'Datos inválidos', detalles);
    }
    if (origen === 'body') req.body = resultado.data;
    next();
};

module.exports = validar;

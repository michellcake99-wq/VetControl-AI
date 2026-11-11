class ErrorHttp extends Error {
    constructor(estado, mensaje, detalles) {
        super(mensaje);
        this.estado = estado;
        this.detalles = detalles;
    }
}

const noEncontrado = (recurso) => new ErrorHttp(404, `${recurso} no encontrado(a)`);
const sinPermiso = (mensaje = 'No tiene permiso para acceder a este recurso') => new ErrorHttp(403, mensaje);

module.exports = { ErrorHttp, noEncontrado, sinPermiso };

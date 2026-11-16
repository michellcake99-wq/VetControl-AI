import { aFecha } from './format.js';

const DIAS_AVISO = 30;

/** Estado de la próxima dosis para mostrar una etiqueta de color. */
export function estadoDosis(proximaDosis) {
  if (!proximaDosis) return { clase: 'finalizado', texto: 'Sin refuerzo' };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((aFecha(proximaDosis) - hoy) / 86_400_000);
  if (dias < 0) return { clase: 'vencida', texto: 'Refuerzo vencido' };
  if (dias === 0) return { clase: 'proxima', texto: 'Refuerzo hoy' };
  if (dias <= DIAS_AVISO) {
    return {
      clase: 'proxima',
      texto: `Refuerzo en ${dias} ${dias === 1 ? 'día' : 'días'}`,
    };
  }
  return { clase: 'al-dia', texto: 'Al día' };
}

/**
 * Estado de una vacuna dentro del carné: si después se aplicó otra dosis de la
 * misma vacuna, esta ya no está vencida sino que su refuerzo fue aplicado.
 */
export function estadoEnCarne(vacuna, vacunas) {
  const huboRefuerzo = vacunas.some(
    (otra) =>
      otra.id_vacuna !== vacuna.id_vacuna &&
      otra.nombre === vacuna.nombre &&
      otra.fecha_aplicacion > vacuna.fecha_aplicacion
  );
  if (huboRefuerzo) return { clase: 'finalizado', texto: 'Refuerzo aplicado' };
  return estadoDosis(vacuna.proxima_dosis);
}

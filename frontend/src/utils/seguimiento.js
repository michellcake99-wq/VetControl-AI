// Ep4-Hu3: ayudas para mostrar el seguimiento de peso de una mascota

export const ROL_REGISTRADOR = {
  propietario: 'Propietario',
  veterinario: 'Veterinario',
  administrador: 'Administrador',
};

/** 28.5 -> "28,5 kg" (hasta dos decimales, con coma) */
export const formatoPeso = (kg) =>
  `${Number(kg).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;

/**
 * Cambio entre el registro más reciente y el anterior.
 * `registros` viene del más reciente al más antiguo. Devuelve null si hay menos de dos.
 */
export function variacion(registros) {
  if (registros.length < 2) return null;
  const diferencia =
    Math.round((registros[0].peso_kg - registros[1].peso_kg) * 100) / 100;
  if (diferencia === 0) return { diferencia, clase: 'igual', texto: 'Sin cambios' };
  return {
    diferencia,
    clase: diferencia > 0 ? 'sube' : 'baja',
    texto: `${diferencia > 0 ? '+' : '−'}${formatoPeso(Math.abs(diferencia))}`,
  };
}

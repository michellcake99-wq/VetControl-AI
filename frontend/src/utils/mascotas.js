/** Convierte una fecha de nacimiento (AAAA-MM-DD) en un texto legible de edad. */
export function calcularEdad(fechaNacimientoISO) {
  if (!fechaNacimientoISO) return 'Edad no registrada';

  const nacimiento = new Date(fechaNacimientoISO);
  const hoy = new Date();
  let meses =
    (hoy.getFullYear() - nacimiento.getFullYear()) * 12 +
    (hoy.getMonth() - nacimiento.getMonth());
  if (hoy.getDate() < nacimiento.getDate()) meses -= 1;

  if (meses < 0 || Number.isNaN(meses)) return 'Fecha inválida';
  if (meses < 1) return 'Recién nacido/a';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;

  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  const textoAnios = `${anios} ${anios === 1 ? 'año' : 'años'}`;
  return mesesRestantes === 0
    ? textoAnios
    : `${textoAnios} y ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`;
}

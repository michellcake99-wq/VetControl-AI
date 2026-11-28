// Ep8-Hu3: fechas del historial de conversaciones (hora local del navegador)

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const dia = (fecha) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
const diasEntre = (a, b) => Math.round((dia(b) - dia(a)) / 86400000);

/** Hora en formato 12 h: «3:45 p. m.». */
export function formatoHoraChat(iso) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/**
 * Fecha del último mensaje en la lista de conversaciones:
 * hoy -> la hora; ayer -> «Ayer»; este año -> «12 nov»; antes -> «12 nov 2025».
 */
export function fechaDeLista(iso, ahora = new Date()) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const dif = diasEntre(f, ahora);
  if (dif === 0) return formatoHoraChat(iso);
  if (dif === 1) return 'Ayer';
  const base = `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
  return f.getFullYear() === ahora.getFullYear()
    ? base
    : `${base} ${f.getFullYear()}`;
}

/** Separador de día dentro de la conversación: «Hoy», «Ayer», «12 de noviembre» o «3 de mayo de 2025». */
export function etiquetaDia(iso, ahora = new Date()) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  const dif = diasEntre(f, ahora);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  const base = `${f.getDate()} de ${MESES[f.getMonth()]}`;
  return f.getFullYear() === ahora.getFullYear()
    ? base
    : `${base} de ${f.getFullYear()}`;
}

/** Fecha completa para el atributo title: «jueves, 12 de noviembre de 2026, 3:45 p. m.». */
export function fechaCompleta(iso) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** ¿Dos mensajes son de días distintos? */
export const cambiaDeDia = (isoA, isoB) =>
  dia(new Date(isoA)).getTime() !== dia(new Date(isoB)).getTime();

/** Conversaciones de la más reciente a la más antigua (por su último mensaje o, si no tiene, su creación). */
export const ordenarConversaciones = (lista) =>
  [...lista].sort(
    (a, b) =>
      new Date(b.ultimo_mensaje?.fecha_envio ?? b.fecha_registro) -
      new Date(a.ultimo_mensaje?.fecha_envio ?? a.fecha_registro)
  );

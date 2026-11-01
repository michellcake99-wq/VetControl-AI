export const iniciales = (nombre = '', apellido = '') =>
  `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// "lunes, 12 de octubre"
export const fechaLarga = (fecha = new Date()) =>
  new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha);

// "Miércoles, 14 de octubre · 10:30 a. m."
export const fechaCita = (iso) => {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${capitalizar(dia)} · ${hora}`;
};

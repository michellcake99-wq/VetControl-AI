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

// Convierte 'AAAA-MM-DD' (fecha sin hora) o un ISO con hora en un Date local.
// Las fechas sin hora se arman a mano para que no "retrocedan" un día por la zona horaria.
export const aFecha = (valor) => {
  if (!valor) return null;
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return soloFecha
    ? new Date(+soloFecha[1], +soloFecha[2] - 1, +soloFecha[3])
    : new Date(valor);
};

// "12 nov. 2026"
export const fechaCorta = (valor) => {
  const d = aFecha(valor);
  return d
    ? new Intl.DateTimeFormat('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d)
    : '—';
};

// "12 nov. 2026 · 10:30 a. m."
export const fechaHoraCorta = (valor) => {
  const d = aFecha(valor);
  if (!d) return '—';
  const hora = new Intl.DateTimeFormat('es-EC', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${fechaCorta(valor)} · ${hora}`;
};

// Fecha local de hoy como 'AAAA-MM-DD' (para inputs type="date")
export const hoyISO = () => aISO(new Date());

// Date -> 'AAAA-MM-DD' en hora local
export const aISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Suma días a una fecha 'AAAA-MM-DD' y devuelve otra 'AAAA-MM-DD'
export const sumarDias = (fechaISO, dias) => {
  const d = aFecha(fechaISO);
  d.setDate(d.getDate() + dias);
  return aISO(d);
};

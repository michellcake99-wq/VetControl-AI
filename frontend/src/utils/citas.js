// Ep3-Hu14: estados de una cita tal como los muestra la interfaz.
// Equivalencias con los criterios: «solicitada» = programada, «completada» = atendida.
export const ESTADOS_CITA = {
  programada: { etiqueta: 'Solicitada', clase: 'solicitada' },
  confirmada: { etiqueta: 'Confirmada', clase: 'confirmada' },
  reprogramada: { etiqueta: 'Reprogramada', clase: 'solicitada' },
  atendida: { etiqueta: 'Completada', clase: 'completada' },
  cancelada: { etiqueta: 'Cancelada', clase: 'cancelada' },
  no_asistio: { etiqueta: 'No asistió', clase: 'no-asistio' },
};

// Filtros por estado en el listado
export const FILTROS_ESTADO = [
  ['', 'Todas'],
  ['programada', 'Solicitadas'],
  ['confirmada', 'Confirmadas'],
  ['atendida', 'Completadas'],
  ['cancelada', 'Canceladas'],
  ['no_asistio', 'No asistió'],
];

/** Estados en los que la cita sigue pendiente (se puede confirmar, completar o cancelar). */
export const esActiva = (estado) =>
  ['programada', 'confirmada', 'reprogramada'].includes(estado);

// Las citas se agendan en la hora de la clínica (Colombia, UTC-5)
export const ZONA_CLINICA = 'America/Bogota';
const OFFSET_CLINICA = '-05:00';

/** 'AAAA-MM-DD' + 'HH:MM' (hora de la clínica) -> ISO con zona, para la API */
export const fechaHoraClinica = (fecha, hora) =>
  `${fecha}T${hora}:00${OFFSET_CLINICA}`;

/** Fecha 'AAAA-MM-DD' de un instante, en la zona de la clínica */
export const diaClinica = (valor) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CLINICA }).format(
    new Date(valor)
  );

/** "10:30 a. m." en la hora de la clínica */
export const horaClinica = (valor) =>
  new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: ZONA_CLINICA,
  }).format(new Date(valor));

/** "Viernes, 20 de noviembre de 2026" (encabezado de cada día de la agenda) */
export const diaLargo = (valor) => {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: ZONA_CLINICA,
  }).format(new Date(valor));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Horas de atención que se ofrecen al solicitar una cita: 07:00 a 18:30, cada 30 minutos */
export const HORAS_DEL_DIA = Array.from({ length: 24 }, (_, i) => {
  const minutos = 7 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
});

/** "14:30" -> "2:30 p. m." */
export const horaLegible = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`;
};

/**
 * Tipos de consulta de una cita (mismos valores que la base de datos).
 * duracion = minutos sugeridos al elegir el tipo (se puede cambiar).
 */
export const TIPOS_CONSULTA = [
  { valor: 'consulta_general', etiqueta: 'Consulta general', duracion: 30 },
  { valor: 'vacunacion', etiqueta: 'Vacunación', duracion: 15 },
  { valor: 'control', etiqueta: 'Control / seguimiento', duracion: 30 },
  { valor: 'desparasitacion', etiqueta: 'Desparasitación', duracion: 15 },
  { valor: 'cirugia', etiqueta: 'Cirugía', duracion: 60 },
  { valor: 'urgencia', etiqueta: 'Urgencia', duracion: 30 },
  { valor: 'otro', etiqueta: 'Otro', duracion: 30 },
];

export const etiquetaTipoConsulta = (valor) =>
  TIPOS_CONSULTA.find((t) => t.valor === valor)?.etiqueta ?? 'Consulta general';
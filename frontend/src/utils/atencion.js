// Ep8-Hu4: estado de atención del veterinario (mismas reglas que backend/utils/atencion.js)
const ZONA = 'America/Bogota';
const DIAS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMBRES_DIA = [
  '',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];
const ABREVIATURAS_DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Día de la semana (1 = lunes ... 7 = domingo) y minutos desde la medianoche, en hora de Colombia. */
function momentoEnZona(ahora) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return {
    dia: DIAS[valor('weekday')],
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
}

const aMinutos = (hora) => {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
};

/** "14:00" -> "2:00 p. m." */
export function formatoHora(hora) {
  const [h, m] = hora.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * Dice si el veterinario está en horario de atención en este momento.
 * horario: [{ dia_semana, hora_inicio: 'HH:MM', hora_fin: 'HH:MM' }]
 * Devuelve { en_horario: true | false | null, proxima_atencion } (null = sin horario registrado).
 */
export function estadoHorario(horario, ahora = new Date()) {
  if (!horario?.length) return { en_horario: null, proxima_atencion: null };
  const { dia, minutos } = momentoEnZona(ahora);
  const franjas = horario
    .map((h) => ({
      dia: h.dia_semana,
      ini: aMinutos(h.hora_inicio),
      fin: aMinutos(h.hora_fin),
      hora: h.hora_inicio,
    }))
    .sort((a, b) => a.dia - b.dia || a.ini - b.ini);

  if (
    franjas.some((f) => f.dia === dia && f.ini <= minutos && minutos < f.fin)
  ) {
    return { en_horario: true, proxima_atencion: null };
  }
  for (let salto = 0; salto <= 7; salto++) {
    const diaBuscado = ((dia - 1 + salto) % 7) + 1;
    const siguiente = franjas.find(
      (f) => f.dia === diaBuscado && (salto > 0 || f.ini > minutos)
    );
    if (siguiente) {
      return {
        en_horario: false,
        proxima_atencion: {
          dia_semana: diaBuscado,
          hora_inicio: siguiente.hora,
          hoy: salto === 0,
        },
      };
    }
  }
  return { en_horario: false, proxima_atencion: null };
}

/** "hoy a las 2:00 p. m." / "el lunes a las 7:00 a. m." */
export function textoProximaAtencion(proxima) {
  if (!proxima) return null;
  const cuando = proxima.hoy ? 'hoy' : `el ${NOMBRES_DIA[proxima.dia_semana]}`;
  return `${cuando} a las ${formatoHora(proxima.hora_inicio)}`;
}

/**
 * Horario de la semana agrupando los días que atienden igual:
 * [{ dias: 'Lun a Vie', horas: '7:00 a. m. – 12:00 p. m. y 2:00 p. m. – 6:00 p. m.' }]
 */
export function resumenHorario(horario) {
  const porDia = new Map();
  for (const h of [...horario].sort(
    (a, b) =>
      a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio)
  )) {
    const franjas = porDia.get(h.dia_semana) ?? [];
    franjas.push(`${formatoHora(h.hora_inicio)} – ${formatoHora(h.hora_fin)}`);
    porDia.set(h.dia_semana, franjas);
  }
  const grupos = [];
  for (const [dia, franjas] of porDia) {
    const horas = franjas.join(' y ');
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horas === horas && ultimo.fin === dia - 1) {
      ultimo.fin = dia;
    } else {
      grupos.push({ inicio: dia, fin: dia, horas });
    }
  }
  return grupos.map((g) => ({
    dias:
      g.inicio === g.fin
        ? ABREVIATURAS_DIA[g.inicio]
        : `${ABREVIATURAS_DIA[g.inicio]} a ${ABREVIATURAS_DIA[g.fin]}`,
    horas: g.horas,
  }));
}

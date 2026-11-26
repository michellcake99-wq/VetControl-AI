// Ep5-Hu4: pendientes de la mascota (próximas citas, vacunas por aplicar o vencidas y tratamientos activos)
import { aFecha, fechaCorta } from './format.js';
import { etiquetaTipoConsulta, horaClinica } from './citas.js';

/** Estado de un pendiente tal como lo muestra la interfaz (usa las clases `estado--*` de index.css). */
export const ESTADO_PENDIENTE = {
  proximo: { clase: 'proxima', texto: 'Próximo' },
  vencido: { clase: 'vencida', texto: 'Vencido' },
};

/** "2026-10-02" -> { dia: "02 oct", anio: "2026" } */
export function partesFecha(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return { dia: '—', anio: '' };
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = new Intl.DateTimeFormat('es-CO', { month: 'short' })
    .format(fecha)
    .replace('.', '')
    .slice(0, 3);
  return { dia: `${dia} ${mes}`, anio: String(fecha.getFullYear()) };
}

/** "Hoy", "En 3 días" o "Hace 2 días", según los días que faltan o que pasaron. */
export function cuandoRelativo(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return '';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((fecha - hoy) / 86_400_000);
  if (dias === 0) return 'Hoy';
  const n = Math.abs(dias);
  const texto = `${n} ${n === 1 ? 'día' : 'días'}`;
  return dias > 0 ? `En ${texto}` : `Hace ${texto}`;
}

/** Texto de apoyo de cada pendiente, según su tipo. */
export function detallePendiente(p) {
  if (p.tipo === 'cita') {
    return [
      horaClinica(p.fecha_hora),
      etiquetaTipoConsulta(p.tipo_consulta),
      p.nombre_veterinario && `con ${p.nombre_veterinario}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (p.tipo === 'vacuna') {
    return `Refuerzo · última dosis ${fechaCorta(p.fecha_aplicacion)} · ${cuandoRelativo(p.fecha)}`;
  }
  const dosis = [p.dosis, p.frecuencia, p.via].filter(Boolean).join(' · ');
  const plazo = p.fecha_fin
    ? `Termina el ${fechaCorta(p.fecha_fin)} (${cuandoRelativo(p.fecha_fin).toLowerCase()})`
    : `En curso desde el ${fechaCorta(p.fecha_inicio)}`;
  return [dosis, plazo].filter(Boolean).join(' · ');
}

/** Etiqueta corta del tipo de pendiente (para lectores de pantalla y para el icono). */
export const ETIQUETA_TIPO_PENDIENTE = {
  cita: 'Cita',
  vacuna: 'Vacuna',
  tratamiento: 'Tratamiento',
};

/** Pantalla a la que lleva cada pendiente al tocarlo. */
export function destinoPendiente(p, idMascota) {
  if (p.tipo === 'cita') return '/citas';
  if (p.tipo === 'vacuna') return `/mascotas/${idMascota}/carne`;
  return `/consultas/${p.id_consulta}`;
}

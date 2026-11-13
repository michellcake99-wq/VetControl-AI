const { z } = require('zod');

// Estados de una cita, tal como están en el tipo estado_cita de database/schema.sql.
// Equivalencias con los criterios de la historia: «solicitada» = programada, «completada» = atendida.
const ESTADOS_CITA = ['programada', 'reprogramada', 'cancelada', 'atendida', 'no_asistio'];

const fechaHora = z.iso.datetime({
  offset: true,
  message: 'Fecha y hora inválida (use el formato ISO 8601, por ejemplo 2026-11-20T10:30:00-05:00)',
});
const fechaDia = z.iso.date({ message: 'Fecha inválida (use AAAA-MM-DD)' });

// Ep3-Hu10: una cita nace con estado "programada" (la «solicitada» de los criterios) y no puede estar en el pasado
const citaCrear = z
  .object({
    id_mascota: z.number({ message: 'Es obligatorio' }).int().positive(),
    id_veterinario: z.number({ message: 'Es obligatorio' }).int().positive(),
    fecha_hora: fechaHora,
    duracion_min: z.number().int().min(10, 'Mínimo 10 minutos').max(240, 'Máximo 240 minutos').default(30),
    motivo: z.string().trim().min(1, 'Es obligatorio').max(200, 'Máximo 200 caracteres'),
  })
  .refine((d) => new Date(d.fecha_hora) > new Date(), {
    message: 'No se puede agendar una cita en una fecha u hora pasada',
    path: ['fecha_hora'],
  });

// "programada" no se puede elegir: es el estado inicial
const citaEstado = z.object({
  estado: z.enum(['cancelada', 'atendida', 'no_asistio'], {
    message: 'Estado inválido (use cancelada, atendida o no_asistio)',
  }),
  observaciones: z.string().trim().max(1000, 'Máximo 1000 caracteres').nullish(),
});

const idOpcional = z.coerce.number().int().positive('Id inválido').optional();
const citaListado = z.object({
  estado: z.enum(ESTADOS_CITA, { message: `Estado inválido (${ESTADOS_CITA.join(', ')})` }).optional(),
  desde: fechaDia.optional(),
  hasta: fechaDia.optional(),
  id_mascota: idOpcional,
  id_veterinario: idOpcional,
  orden: z.enum(['asc', 'desc'], { message: 'Use asc o desc' }).optional(),
});

module.exports = { ESTADOS_CITA, citaCrear, citaEstado, citaListado };

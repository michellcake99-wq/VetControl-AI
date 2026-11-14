const { z } = require('zod');

// Nota: en zod v4 los .default() se aplican incluso con .partial(); por eso
// los valores por defecto se ponen solo en los esquemas de creación.
const texto = (max) => z.string().trim().min(1, 'Es obligatorio').max(max, `Máximo ${max} caracteres`);
const textoOpc = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`).nullish();
const fecha = z.iso.date({ message: 'Fecha inválida (use AAAA-MM-DD)' });
const alMenosUno = { message: 'Debe enviar al menos un campo' };
const noVacio = (d) => Object.keys(d).length > 0;

const parametroId = z.object({ id: z.coerce.number().int().positive('Id inválido') });

// --------------------------- Propietarios ---------------------------
const tipoDocumento = z.enum(['CC', 'CE', 'TI', 'PA', 'NIT']);
const numeroDocumento = z.string().trim().regex(/^[A-Za-z0-9-]{5,20}$/, 'Documento inválido');
const telefono = z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, 'Teléfono inválido');

const propietarioCrear = z.object({
    // datos de la cuenta (tabla usuarios)
    nombre: texto(80),
    apellido: texto(80),
    correo: z.email('Correo inválido'),
    contrasena: z.string().min(8, 'La contraseña debe tener mínimo 8 caracteres'),
    // datos del perfil (tabla propietarios)
    tipo_documento: tipoDocumento.default('CC'),
    numero_documento: numeroDocumento,
    telefono,
    direccion: textoOpc(150),
});

const propietarioActualizar = z.object({
    nombre: texto(80),
    apellido: texto(80),
    tipo_documento: tipoDocumento,
    numero_documento: numeroDocumento,
    telefono,
    direccion: textoOpc(150),
}).partial().refine(noVacio, alMenosUno);

// ----------------------------- Mascotas -----------------------------
const sexo = z.enum(['macho', 'hembra', 'desconocido']);
const camposMascota = {
    id_propietario: z.number().int().positive(),
    nombre: texto(60),
    especie: texto(40).transform((s) => s.toLowerCase()),
    raza: textoOpc(60),
    fecha_nacimiento: fecha.refine((d) => new Date(d) <= new Date(), 'No puede ser una fecha futura').nullish(),
    color: textoOpc(40),
    peso_kg: z.number().positive('Debe ser mayor a 0').max(2000).nullish(),
    microchip: textoOpc(30),
    observaciones: textoOpc(2000),
};
const mascotaCrear = z.object({
    ...camposMascota,
    sexo: sexo.default('desconocido'),
    esterilizado: z.boolean().default(false),
});
const mascotaActualizar = z.object({ ...camposMascota, sexo, esterilizado: z.boolean() })
    .partial().refine(noVacio, alMenosUno);

// ------------------------- Historia clínica -------------------------
const historiaActualizar = z.object({
    antecedentes: textoOpc(5000),
    alergias: textoOpc(2000),
    enfermedades_cronicas: textoOpc(2000),
}).refine(noVacio, alMenosUno);

const camposConsulta = {
    id_cita: z.number().int().positive().nullish(),
    fecha: z.iso.datetime({ offset: true, message: 'Fecha y hora inválida (ISO 8601)' }).optional(),
    motivo: texto(200),
    anamnesis: textoOpc(5000),
    peso_kg: z.number().positive().max(2000).nullish(),
    temperatura_c: z.number().min(30, 'Mínimo 30 °C').max(45, 'Máximo 45 °C').nullish(),
    frecuencia_cardiaca: z.number().int().positive().max(400).nullish(),
    frecuencia_respiratoria: z.number().int().positive().max(200).nullish(),
    examen_fisico: textoOpc(5000),
    diagnostico: texto(5000),
    observaciones: textoOpc(5000),
    proximo_control: fecha.nullish(),
};
const consultaCrear = z.object(camposConsulta);
const consultaActualizar = z.object(camposConsulta).omit({ id_cita: true }).partial().refine(noVacio, alMenosUno);

const fechasCoherentes = (d) => !d.fecha_inicio || !d.fecha_fin || d.fecha_fin >= d.fecha_inicio;
const errorFechas = { message: 'fecha_fin no puede ser anterior a fecha_inicio', path: ['fecha_fin'] };
const camposTratamiento = {
    medicamento: texto(120),
    dosis: texto(60),
    frecuencia: texto(60),
    via: textoOpc(30),
    fecha_inicio: fecha.optional(),
    fecha_fin: fecha.nullish(),
    indicaciones: textoOpc(2000),
};
const tratamientoCrear = z.object(camposTratamiento).refine(fechasCoherentes, errorFechas);
const tratamientoActualizar = z.object({ ...camposTratamiento, estado: z.enum(['activo', 'finalizado', 'suspendido']) })
    .partial().refine(noVacio, alMenosUno).refine(fechasCoherentes, errorFechas);

const vacunaCrear = z.object({
    nombre: texto(100),
    laboratorio: textoOpc(100),
    lote: textoOpc(50),
    fecha_aplicacion: fecha,
    proxima_dosis: fecha.nullish(),
    observaciones: textoOpc(1000),
}).refine((d) => !d.proxima_dosis || d.proxima_dosis > d.fecha_aplicacion, {
    message: 'proxima_dosis debe ser posterior a fecha_aplicacion', path: ['proxima_dosis'],
});

const evolucionCrear = z.object({
    estado_general: z.number().int().min(1, 'Entre 1 y 5').max(5, 'Entre 1 y 5'),
    dosis_aplicada: z.boolean().default(true),
    descripcion: texto(2000),
});

// ------------------------------- Chat -------------------------------
const idPositivo = z.coerce.number().int().positive('Id inválido');

const conversacionCrear = z.object({
    id_veterinario: idPositivo,
    id_mascota: idPositivo.nullish(),   // opcional: la conversación puede no tratar de una mascota
});

const mensajeEnviar = z.object({
    id_conversacion: idPositivo,
    contenido: z.string().trim()
        .min(1, 'El mensaje no puede estar vacío')
        .max(1000, 'El mensaje no puede tener más de 1000 caracteres'),
});

// --------------------------- Veterinarios ---------------------------
const veterinarioCrear = z.object({
    nombre: texto(80),
    apellido: texto(80),
    correo: z.email('Correo inválido'),
    contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    tarjeta_profesional: texto(30),
    especialidad: texto(80),
    telefono: telefono.optional(),
});

// Para actualizar no se permite cambiar la contraseña ni el correo por esta vía
const veterinarioActualizar = veterinarioCrear
    .omit({ contrasena: true, correo: true })
    .partial()
    .refine(noVacio, alMenosUno);

// 1 = lunes ... 7 = domingo (igual que el CHECK de horarios_veterinario en schema.sql)
const diaSemana = z.number().int().min(1, 'Debe estar entre 1 (lunes) y 7 (domingo)')
    .max(7, 'Debe estar entre 1 (lunes) y 7 (domingo)');
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato esperado HH:MM');
const finDespuesDeInicio = (h) => !h.hora_inicio || !h.hora_fin || h.hora_fin > h.hora_inicio;
const mensajeRango = { message: 'La hora de fin debe ser posterior a la de inicio', path: ['hora_fin'] };

const horarioCrear = z.object({
    dia_semana: diaSemana,
    hora_inicio: hora,
    hora_fin: hora,
}).refine(finDespuesDeInicio, mensajeRango);

const horarioActualizar = z.object({
    dia_semana: diaSemana,
    hora_inicio: hora,
    hora_fin: hora,
}).partial().refine(noVacio, alMenosUno).refine(finDespuesDeInicio, mensajeRango);

module.exports = {
    parametroId,
    propietarioCrear, propietarioActualizar,
    mascotaCrear, mascotaActualizar,
    historiaActualizar, consultaCrear, consultaActualizar,
    tratamientoCrear, tratamientoActualizar, vacunaCrear, evolucionCrear,
    conversacionCrear, mensajeEnviar,
    veterinarioCrear, veterinarioActualizar, horarioCrear, horarioActualizar,
};

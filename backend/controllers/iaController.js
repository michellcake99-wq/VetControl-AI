// Ep6-Hu1: endpoint propio para consultar al asistente de IA
const { query } = require('../utils/baseDatos');
const { ErrorHttp } = require('../utils/errores');
const { obtenerMascotaAutorizada } = require('../utils/acceso');
const { generarRespuesta, config } = require('../utils/servicioIA');

const limite = () => ({
    consultas: Number(process.env.IA_LIMITE_CONSULTAS) || 20,
    minutos: Number(process.env.IA_VENTANA_MINUTOS) || 60,
});

const INSTRUCCIONES = `Eres el asistente de VetControl AI, la plataforma de una clínica veterinaria.
Respondes en español, de forma clara, breve y amable.
- Solo atiendes temas de cuidado, salud y bienestar de mascotas, y del uso de la plataforma.
- Si se incluyen datos de una mascota, úsalos tal como vienen y no inventes información que no esté ahí.
- Tus respuestas son un apoyo y no reemplazan el criterio de un veterinario: no des diagnósticos definitivos
  ni indiques dosis de medicamentos. Ante síntomas graves o una emergencia, recomienda acudir a la clínica.
- Si te preguntan algo que no tiene que ver con mascotas, explica con amabilidad que no puedes ayudar con eso.`;

/** Revisa cuántas consultas hizo el usuario en la ventana de tiempo y corta si pasó el límite. */
async function verificarLimite(idUsuario) {
    const { consultas, minutos } = limite();
    const { rows } = await query(
        `SELECT count(*)::int AS usadas, min(fecha) AS primera
           FROM interacciones_ia
          WHERE id_usuario = $1 AND fecha > now() - make_interval(mins => $2)`,
        [idUsuario, minutos]
    );
    const { usadas, primera } = rows[0];
    if (usadas >= consultas) {
        // Se libera un cupo cuando la consulta más antigua sale de la ventana
        const esperaMin = Math.max(1, Math.ceil((new Date(primera).getTime() + minutos * 60000 - Date.now()) / 60000));
        throw new ErrorHttp(429, `Alcanzaste el límite de ${consultas} consultas al asistente cada ${minutos} minutos. `
            + `Podrás consultar de nuevo en ${esperaMin} ${esperaMin === 1 ? 'minuto' : 'minutos'}.`);
    }
    return consultas - usadas;
}

/** Resume los datos de una mascota para darle contexto a la IA (solo de esa mascota). */
async function contextoMascota(mascota) {
    const [historia, consultas, tratamientos, vacunas] = await Promise.all([
        query('SELECT antecedentes, alergias, enfermedades_cronicas FROM historias_clinicas WHERE id_mascota = $1', [mascota.id_mascota]),
        query(
            `SELECT c.fecha::date AS fecha, c.motivo, c.diagnostico FROM consultas c
               JOIN historias_clinicas h ON h.id_historia = c.id_historia
              WHERE h.id_mascota = $1 ORDER BY c.fecha DESC LIMIT 5`,
            [mascota.id_mascota]
        ),
        query(
            `SELECT t.medicamento, t.dosis, t.frecuencia FROM tratamientos t
               JOIN consultas c ON c.id_consulta = t.id_consulta
               JOIN historias_clinicas h ON h.id_historia = c.id_historia
              WHERE h.id_mascota = $1 AND t.estado = 'activo'`,
            [mascota.id_mascota]
        ),
        query(
            `SELECT v.nombre, v.fecha_aplicacion, v.proxima_dosis FROM vacunas v
               JOIN historias_clinicas h ON h.id_historia = v.id_historia
              WHERE h.id_mascota = $1 ORDER BY v.fecha_aplicacion`,
            [mascota.id_mascota]
        ),
    ]);
    const h = historia.rows[0] ?? {};
    const lista = (filas, formato) => (filas.length ? filas.map((f) => `  - ${formato(f)}`).join('\n') : '  - Ninguno');
    return [
        `Datos de la mascota ${mascota.nombre}:`,
        `- Especie: ${mascota.especie}; raza: ${mascota.raza ?? 'no registrada'}; sexo: ${mascota.sexo}; `
            + `nacimiento: ${mascota.fecha_nacimiento ?? 'no registrado'}; peso: ${mascota.peso_kg ?? 'no registrado'} kg`,
        `- Alergias: ${h.alergias || 'no registradas'}`,
        `- Enfermedades crónicas: ${h.enfermedades_cronicas || 'no registradas'}`,
        `- Antecedentes: ${h.antecedentes || 'no registrados'}`,
        '- Últimas consultas:',
        lista(consultas.rows, (c) => `${c.fecha}: ${c.motivo}. Diagnóstico: ${c.diagnostico}`),
        '- Tratamientos activos:',
        lista(tratamientos.rows, (t) => `${t.medicamento} ${t.dosis}, ${t.frecuencia}`),
        '- Vacunas:',
        lista(vacunas.rows, (v) => `${v.nombre}, aplicada ${v.fecha_aplicacion}, próxima dosis ${v.proxima_dosis ?? 'no requiere'}`),
    ].join('\n');
}

async function registrarInteraccion(datos) {
    const { rows } = await query(
        `INSERT INTO interacciones_ia (id_usuario, id_mascota, pregunta, respuesta, modelo, exitosa, error, duracion_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_interaccion, fecha`,
        [datos.id_usuario, datos.id_mascota ?? null, datos.pregunta, datos.respuesta ?? null, datos.modelo ?? null,
            datos.exitosa, datos.error ? String(datos.error).slice(0, 300) : null, datos.duracion_ms]
    );
    return rows[0];
}

/** Llama a la IA, guarda la interacción (también si falla) y devuelve lo que se responde al cliente. */
async function ejecutarIA({ usuario, mascota, mensajes, pregunta, restantes }) {
    const inicio = Date.now();
    const base = { id_usuario: usuario.id_usuario, id_mascota: mascota?.id_mascota, pregunta };
    try {
        const { respuesta, modelo } = await generarRespuesta(mensajes);
        const guardada = await registrarInteraccion({
            ...base, respuesta, modelo, exitosa: true, duracion_ms: Date.now() - inicio,
        });
        return {
            id_interaccion: Number(guardada.id_interaccion),
            respuesta,
            modelo,
            fecha: guardada.fecha,
            consultas_restantes: restantes - 1,
        };
    } catch (error) {
        // También se guarda el intento fallido (cuenta para el límite y queda el registro del error)
        await registrarInteraccion({
            ...base, modelo: config().modelo, exitosa: false,
            error: error.causa ?? error.message, duracion_ms: Date.now() - inicio,
        }).catch(() => {});
        throw error;
    }
}

// POST /api/ia/consultar   { pregunta, id_mascota? }
async function consultar(req, res) {
    const { pregunta, id_mascota: idMascota } = req.body;
    const usuario = req.usuario;

    const restantes = await verificarLimite(usuario.id_usuario);
    // Si se indica una mascota, el usuario debe poder verla (el propietario solo las suyas)
    const mascota = idMascota ? await obtenerMascotaAutorizada(idMascota, usuario) : null;

    const mensajes = [{ role: 'system', content: INSTRUCCIONES }];
    if (mascota) mensajes.push({ role: 'system', content: await contextoMascota(mascota) });
    mensajes.push({ role: 'user', content: pregunta });

    res.json(await ejecutarIA({ usuario, mascota, mensajes, pregunta, restantes }));
}

// Ep6-Hu2: resumen de la historia clínica
const AVISO_RESUMEN = 'Resumen generado por inteligencia artificial a partir de los registros de la clínica. '
    + 'Es un apoyo y no reemplaza el criterio del veterinario; verifica los datos importantes en la historia clínica.';

const INSTRUCCIONES_RESUMEN = `Eres el asistente de VetControl AI, la plataforma de una clínica veterinaria.
Tu tarea es resumir la historia clínica de UNA mascota en español, de forma breve y clara.
Usa ÚNICAMENTE los datos que se te entregan de esa mascota: no inventes información, no agregues diagnósticos
ni recomendaciones, y no uses datos de otras mascotas. Si falta información de una sección, escribe "Sin registros".
Responde en texto plano (sin asteriscos ni símbolos de formato) con exactamente estas cuatro secciones, cada título
en su propia línea terminando en dos puntos, y los elementos como líneas que empiezan con "- ":
Antecedentes:
Diagnósticos recientes:
Tratamientos activos:
Vacunas:`;

// POST /api/ia/resumir-historial   { id_mascota }
async function resumirHistorial(req, res) {
    const usuario = req.usuario;
    const mascota = await obtenerMascotaAutorizada(req.body.id_mascota, usuario);
    const restantes = await verificarLimite(usuario.id_usuario);

    const mensajes = [
        { role: 'system', content: INSTRUCCIONES_RESUMEN },
        { role: 'user', content: `${await contextoMascota(mascota)}\n\nResume la historia clínica de ${mascota.nombre}.` },
    ];
    const resultado = await ejecutarIA({
        usuario, mascota, mensajes, restantes, pregunta: `Resumen del historial de ${mascota.nombre}`,
    });
    res.json({ ...resultado, aviso: AVISO_RESUMEN });
}

module.exports = { consultar, resumirHistorial };
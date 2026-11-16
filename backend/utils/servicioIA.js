// Ep6-Hu1: conexión con el servicio de inteligencia artificial.
//
// Usa la API compatible con OpenAI ("chat/completions"), así que sirve para Groq
// (por defecto, gratis), OpenAI, Gemini u otro proveedor compatible cambiando solo
// las variables de entorno. La clave NUNCA va en el código: se lee de IA_API_KEY.
const { ErrorHttp } = require('./errores');

const config = () => ({
    clave: process.env.IA_API_KEY,
    urlBase: (process.env.IA_URL_BASE || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
    modelo: process.env.IA_MODELO || 'openai/gpt-oss-120b',
    tiempoMaximoMs: Number(process.env.IA_TIEMPO_MAXIMO_MS) || 30000,
    maxTokens: Number(process.env.IA_MAX_TOKENS) || 1500,
});

/** Error del servicio de IA, con un mensaje claro para el usuario. */
class ErrorIA extends ErrorHttp {
    constructor(estado, mensaje, causa) {
        super(estado, mensaje);
        this.causa = causa; // detalle técnico (se guarda en interacciones_ia, no se muestra)
    }
}

/**
 * Envía la conversación al servicio de IA y devuelve el texto de la respuesta.
 * @param {{role: 'system'|'user'|'assistant', content: string}[]} mensajes
 * @returns {Promise<{respuesta: string, modelo: string}>}
 */
async function generarRespuesta(mensajes) {
    const { clave, urlBase, modelo, tiempoMaximoMs, maxTokens } = config();
    if (!clave) {
        throw new ErrorIA(503, 'El asistente de IA no está configurado en el servidor.', 'Falta IA_API_KEY en el .env');
    }

    const cuerpo = { model: modelo, messages: mensajes, temperature: 0.3, max_completion_tokens: maxTokens };
    // Los modelos gpt-oss "razonan" antes de responder; con esfuerzo bajo responden más rápido
    if (modelo.startsWith('openai/gpt-oss')) cuerpo.reasoning_effort = process.env.IA_ESFUERZO_RAZONAMIENTO || 'low';

    let respuesta;
    try {
        respuesta = await fetch(`${urlBase}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
            body: JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(tiempoMaximoMs),
        });
    } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw new ErrorIA(504, 'El asistente de IA tardó demasiado en responder. Intenta de nuevo.',
                `Sin respuesta en ${tiempoMaximoMs} ms`);
        }
        throw new ErrorIA(502, 'No se pudo conectar con el servicio de IA. Intenta más tarde.', error.message);
    }

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        const detalle = `HTTP ${respuesta.status}: ${datos?.error?.message ?? 'sin detalle'}`;
        if (respuesta.status === 429) {
            throw new ErrorIA(503, 'El servicio de IA está recibiendo demasiadas consultas. Intenta en unos minutos.', detalle);
        }
        if (respuesta.status === 401 || respuesta.status === 403) {
            throw new ErrorIA(503, 'El asistente de IA no está disponible por un problema de configuración.', detalle);
        }
        throw new ErrorIA(502, 'El servicio de IA no pudo procesar la consulta. Intenta de nuevo.', detalle);
    }

    const texto = datos?.choices?.[0]?.message?.content?.trim();
    if (!texto) {
        throw new ErrorIA(502, 'El servicio de IA devolvió una respuesta vacía. Intenta de nuevo.', 'Respuesta sin contenido');
    }
    return { respuesta: texto, modelo: datos.model || modelo };
}

module.exports = { generarRespuesta, ErrorIA, config };

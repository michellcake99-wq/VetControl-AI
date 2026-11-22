// Envío de correos con la API transaccional de Brevo (https://developers.brevo.com).
// La llave NO va en el código: se define en el .env de cada persona.
//   BREVO_API_KEY=...            (obligatoria para enviar)
//   CORREO_REMITENTE=...         (correo verificado en Brevo)
//   CORREO_NOMBRE=VetControl AI  (opcional)
// Sin llave configurada el envío se omite (las notificaciones siguen apareciendo en la plataforma).
const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

const correoConfigurado = () => Boolean(process.env.BREVO_API_KEY && process.env.CORREO_REMITENTE);

const escapar = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Envía un correo. Devuelve { enviado: true } o { enviado: false, motivo }.
 * Lanza un Error si el servicio de correo responde con un fallo.
 */
async function enviarCorreo({ para, nombre, asunto, texto }) {
    if (!correoConfigurado()) return { enviado: false, motivo: 'sin_configurar' };

    const respuesta = await fetch(URL_BREVO, {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender: { name: process.env.CORREO_NOMBRE || 'VetControl AI', email: process.env.CORREO_REMITENTE },
            to: [{ email: para, name: nombre }],
            subject: asunto,
            htmlContent: `<p>${escapar(texto).replaceAll('\n', '<br>')}</p><p style="color:#888;font-size:12px">VetControl AI</p>`,
            textContent: texto,
        }),
    });
    if (!respuesta.ok) throw new Error(`El servicio de correo respondió ${respuesta.status}`);
    return { enviado: true };
}

module.exports = { enviarCorreo, correoConfigurado };
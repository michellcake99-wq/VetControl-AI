const jwt = require('jsonwebtoken');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const { ErrorHttp, sinPermiso } = require('../utils/errores');
const esquemas = require('../validators/esquemas');
const {
    obtenerConversacionAutorizada,
    verificarPuedeEscribir,
    guardarMensaje,
} = require('../controllers/conversacionesController');

// Ep8-Hu5: el chat es solo entre un propietario y un veterinario
const ROLES_CHAT = ['propietario', 'veterinario'];

/**
 * Carga el perfil actualizado desde la base de datos (rol, id_propietario / id_veterinario)
 * y comprueba que la cuenta siga activa y que su rol pueda usar el chat.
 */
async function perfilConRolDeChat(idUsuario) {
    const req = { usuario: { id_usuario: idUsuario } };
    await new Promise((resolve, reject) => cargarPerfil(req, null, resolve).catch(reject));
    if (!ROLES_CHAT.includes(req.usuario.rol)) {
        throw sinPermiso('El chat es solo entre propietarios y veterinarios');
    }
    return req.usuario;
}

/**
 * Chat (Ep8-Hu1: envío de mensajes · Ep8-Hu5: restricción según el rol).
 *
 * Conexión:  io(url, { auth: { token } })  — el mismo JWT del login.
 * Cliente -> servidor:  'enviar_mensaje' { id_conversacion, contenido },
 *                       ack({ mensaje } | { error, estado })   estado 403 = no permitido
 */
function iniciarChat(io) {
    // Valida el token JWT y el rol al conectarse
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Token de acceso requerido'));
            const { id_usuario } = jwt.verify(token, process.env.JWT_SECRET);
            socket.data.usuario = await perfilConRolDeChat(id_usuario);
            next();
        } catch (error) {
            next(new Error(error instanceof ErrorHttp ? error.message : 'Token inválido o expirado'));
        }
    });

    io.on('connection', (socket) => {
        socket.on('enviar_mensaje', async (datos, ack) => {
            const responder = typeof ack === 'function' ? ack : () => {};
            try {
                const resultado = esquemas.mensajeEnviar.safeParse(datos ?? {});
                if (!resultado.success) {
                    return responder({ error: resultado.error.issues[0].message, estado: 400 });
                }

                // Ep8-Hu5: en CADA evento se vuelve a validar el usuario y su rol
                // (pudo ser desactivado o cambiado de rol después de conectarse)
                const usuario = await perfilConRolDeChat(socket.data.usuario.id_usuario);
                socket.data.usuario = usuario;

                const { id_conversacion, contenido } = resultado.data;
                const conversacion = await obtenerConversacionAutorizada(id_conversacion, usuario);
                await verificarPuedeEscribir(conversacion, usuario);
                // Solo se guarda si pasó todas las validaciones anteriores
                const mensaje = await guardarMensaje(id_conversacion, usuario.id_usuario, contenido);
                responder({ mensaje });
            } catch (error) {
                if (!(error instanceof ErrorHttp)) console.error('Error al enviar mensaje:', error);
                responder(
                    error instanceof ErrorHttp
                        ? { error: error.message, estado: error.estado === 401 ? 403 : error.estado }
                        : { error: 'No se pudo enviar el mensaje', estado: 500 }
                );
            }
        });
    });
}

module.exports = { iniciarChat };

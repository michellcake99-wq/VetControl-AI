const jwt = require('jsonwebtoken');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const { ErrorHttp } = require('../utils/errores');
const esquemas = require('../validators/esquemas');
const { obtenerConversacionAutorizada, guardarMensaje } = require('../controllers/conversacionesController');

/**
 * Chat (Ep8-Hu1: envío de mensajes).
 *
 * Conexión:  io(url, { auth: { token } })  — el mismo JWT del login.
 * Cliente -> servidor:  'enviar_mensaje' { id_conversacion, contenido }, ack({ mensaje } | { error })
 */
function iniciarChat(io) {
    // Valida el token JWT al conectarse y carga el perfil (id_propietario / id_veterinario)
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error('Token de acceso requerido'));
            const req = { usuario: jwt.verify(token, process.env.JWT_SECRET) };
            await new Promise((resolve, reject) => cargarPerfil(req, null, resolve).catch(reject));
            socket.data.usuario = req.usuario;
            next();
        } catch (error) {
            next(new Error(error instanceof ErrorHttp ? error.message : 'Token inválido o expirado'));
        }
    });

    io.on('connection', (socket) => {
        const usuario = socket.data.usuario;

        socket.on('enviar_mensaje', async (datos, ack) => {
            const responder = typeof ack === 'function' ? ack : () => {};
            try {
                const resultado = esquemas.mensajeEnviar.safeParse(datos ?? {});
                if (!resultado.success) return responder({ error: resultado.error.issues[0].message });

                const { id_conversacion, contenido } = resultado.data;
                await obtenerConversacionAutorizada(id_conversacion, usuario);
                const mensaje = await guardarMensaje(id_conversacion, usuario.id_usuario, contenido);
                responder({ mensaje });
            } catch (error) {
                if (!(error instanceof ErrorHttp)) console.error('Error al enviar mensaje:', error);
                responder({ error: error instanceof ErrorHttp ? error.message : 'No se pudo enviar el mensaje' });
            }
        });
    });
}

module.exports = { iniciarChat };

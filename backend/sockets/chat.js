const jwt = require('jsonwebtoken');
const { cargarPerfil } = require('../middleware/cargarPerfil');
const { ErrorHttp, sinPermiso } = require('../utils/errores');
const esquemas = require('../validators/esquemas');
const { query } = require('../utils/baseDatos');
const {
    marcarConectado, marcarDesconectado, estaEnLinea, estadosDeAtencion, avisoFueraDeHorario, salaEstado,
} = require('../utils/atencion');
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

/** El propietario se une a la sala de cada veterinario con el que conversa y recibe su estado actual. */
async function seguirVeterinariosDelPropietario(socket) {
    const { rows } = await query(
        'SELECT DISTINCT id_veterinario FROM conversaciones WHERE id_propietario = $1',
        [socket.data.usuario.id_propietario]
    );
    for (const { id_veterinario } of rows) socket.join(salaEstado(id_veterinario));
    // Primero se une a las salas y después manda el estado, así no se pierde ningún cambio en medio
    socket.emit('estados_veterinarios', rows.map(({ id_veterinario }) => ({
        id_veterinario, en_linea: estaEnLinea(id_veterinario),
    })));
}

/**
 * Chat (Ep8-Hu1: envío de mensajes · Ep8-Hu5: restricción según el rol).
 *
 * Conexión:  io(url, { auth: { token } })  — el mismo JWT del login.
 * Cliente -> servidor:  'enviar_mensaje' { id_conversacion, contenido },
 *                       ack({ mensaje, aviso? } | { error, estado })   estado 403 = no permitido
 *                       (aviso: el propietario escribió fuera del horario de atención del veterinario)
 *
 * Ep8-Hu4: estado de atención del veterinario en tiempo real.
 * Un veterinario está «en línea» mientras tenga el chat abierto. Los propietarios reciben:
 *   'estados_veterinarios' [{ id_veterinario, en_linea }]   al conectarse (veterinarios con los que conversan)
 *   'estado_veterinario'   { id_veterinario, en_linea }      cuando uno se conecta o se desconecta
 *   'horario_actualizado'  { id_veterinario }                cuando cambia su horario de atención
 * y pueden pedir 'seguir_veterinario' { id_veterinario } al iniciar una conversación nueva.
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
        // Ep8-Hu4: presencia del veterinario (se registra de inmediato, antes de cualquier consulta)
        const { id_veterinario: idVeterinarioConectado, rol } = socket.data.usuario;
        if (rol === 'veterinario' && idVeterinarioConectado) {
            if (marcarConectado(idVeterinarioConectado, socket.id)) {
                io.to(salaEstado(idVeterinarioConectado)).emit('estado_veterinario', {
                    id_veterinario: idVeterinarioConectado, en_linea: true,
                });
            }
            socket.on('disconnect', () => {
                if (marcarDesconectado(idVeterinarioConectado, socket.id)) {
                    io.to(salaEstado(idVeterinarioConectado)).emit('estado_veterinario', {
                        id_veterinario: idVeterinarioConectado, en_linea: false,
                    });
                }
            });
        } else if (rol === 'propietario') {
            seguirVeterinariosDelPropietario(socket).catch((error) => console.error('Error al seguir veterinarios:', error));
        }

        // Ep8-Hu4: el propietario empieza a seguir a un veterinario con el que acaba de iniciar una conversación
        socket.on('seguir_veterinario', async (datos, ack) => {
            const responder = typeof ack === 'function' ? ack : () => {};
            try {
                const usuario = await perfilConRolDeChat(socket.data.usuario.id_usuario);
                const id = Number(datos?.id_veterinario);
                if (usuario.rol !== 'propietario') throw sinPermiso();
                if (!Number.isInteger(id) || id <= 0) throw new ErrorHttp(400, 'Veterinario inválido');
                const { rows } = await query(
                    'SELECT 1 FROM conversaciones WHERE id_propietario = $1 AND id_veterinario = $2 LIMIT 1',
                    [usuario.id_propietario, id]
                );
                if (!rows[0]) throw sinPermiso('Solo puede seguir a veterinarios con los que tiene una conversación');
                socket.join(salaEstado(id));
                responder({ estado: { id_veterinario: id, en_linea: estaEnLinea(id) } });
            } catch (error) {
                if (!(error instanceof ErrorHttp)) console.error('Error al seguir veterinario:', error);
                responder(error instanceof ErrorHttp
                    ? { error: error.message, estado: error.estado === 401 ? 403 : error.estado }
                    : { error: 'No se pudo seguir al veterinario', estado: 500 });
            }
        });

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

                // Ep8-Hu4: si el propietario escribe fuera del horario de atención se le avisa
                let aviso = null;
                if (usuario.rol === 'propietario') {
                    const estados = await estadosDeAtencion([conversacion.id_veterinario]);
                    aviso = avisoFueraDeHorario(estados[conversacion.id_veterinario]);
                }
                responder(aviso ? { mensaje, aviso } : { mensaje });
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
// Ep7-Hu4: recuperación de contraseña por correo
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { ErrorHttp } = require('../utils/errores');
const { enviarCorreo, correoConfigurado } = require('../utils/correo');

const MINUTOS_VIGENCIA = 60;
const MAX_SOLICITUDES_POR_HORA = 5;
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Se responde lo mismo exista o no el correo, para no revelar quién tiene cuenta
const MENSAJE_SOLICITUD =
    'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (el enlace vale 1 hora).';
const ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.';

/** Busca un token vigente (no usado y no vencido). */
async function buscarTokenVigente(token, cliente = pool) {
    const { rows } = await cliente.query(
        `SELECT t.id_token, t.id_usuario, u.correo
           FROM tokens_recuperacion t JOIN usuarios u ON u.id_usuario = t.id_usuario
          WHERE t.token_hash = $1 AND NOT t.usado AND t.fecha_expiracion > now() AND u.activo
          FOR UPDATE OF t`,
        [hash(token)]
    );
    return rows[0];
}

// POST /api/auth/olvide-contrasena   { correo }
async function solicitar(req, res) {
    const correo = req.body.correo.trim().toLowerCase();
    const { rows } = await pool.query(
        'SELECT id_usuario, nombre, correo FROM usuarios WHERE lower(correo) = $1 AND activo', [correo]
    );
    const usuario = rows[0];

    if (usuario) {
        const { rows: recientes } = await pool.query(
            `SELECT count(*)::int AS n FROM tokens_recuperacion
              WHERE id_usuario = $1 AND fecha_creacion > now() - interval '1 hour'`,
            [usuario.id_usuario]
        );
        // Tope para que nadie llene de correos a otra persona (se responde igual, sin enviar)
        if (recientes[0].n < MAX_SOLICITUDES_POR_HORA) {
            const token = crypto.randomBytes(32).toString('hex');
            // Un enlace nuevo anula los anteriores sin usar
            await pool.query('UPDATE tokens_recuperacion SET usado = TRUE WHERE id_usuario = $1 AND NOT usado', [usuario.id_usuario]);
            await pool.query(
                `INSERT INTO tokens_recuperacion (id_usuario, token_hash, fecha_expiracion)
                 VALUES ($1, $2, now() + make_interval(mins => $3))`,
                [usuario.id_usuario, hash(token), MINUTOS_VIGENCIA]
            );
            const enlace = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/restablecer-contrasena?token=${token}`;
            try {
                if (correoConfigurado()) {
                    await enviarCorreo({
                        para: usuario.correo,
                        nombre: usuario.nombre,
                        asunto: 'Restablece tu contraseña de VetControl AI',
                        texto: `Hola ${usuario.nombre},\n\nRecibimos una solicitud para restablecer tu contraseña. `
                            + `Entra al siguiente enlace (vale ${MINUTOS_VIGENCIA} minutos y solo se puede usar una vez):\n${enlace}\n\n`
                            + 'Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.',
                    });
                } else if (process.env.NODE_ENV !== 'production') {
                    // Solo en desarrollo, sin correo configurado: el enlace queda en la consola del servidor
                    console.log(`[Recuperación de contraseña] ${usuario.correo}: ${enlace}`);
                }
            } catch (error) {
                console.error('No se pudo enviar el correo de recuperación:', error.message);
            }
        }
    }
    res.json({ mensaje: MENSAJE_SOLICITUD });
}

// POST /api/auth/verificar-token-recuperacion   { token }  -> permite avisar antes de pedir la contraseña nueva
async function verificar(req, res) {
    if (!(await buscarTokenVigente(req.body.token))) throw new ErrorHttp(400, ENLACE_INVALIDO);
    res.json({ valido: true });
}

// POST /api/auth/restablecer-contrasena   { token, contrasena, confirmacion }
async function restablecer(req, res) {
    const { token, contrasena } = req.body;
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const vigente = await buscarTokenVigente(token, cliente);
        if (!vigente) throw new ErrorHttp(400, ENLACE_INVALIDO);

        const nuevoHash = await bcrypt.hash(contrasena, 10);
        await cliente.query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [nuevoHash, vigente.id_usuario]);
        // El token queda usado (y cualquier otro pendiente de esa cuenta también)
        await cliente.query('UPDATE tokens_recuperacion SET usado = TRUE WHERE id_usuario = $1 AND NOT usado', [vigente.id_usuario]);
        // Si la cuenta estaba bloqueada por intentos fallidos, ya puede entrar con su contraseña nueva
        await cliente.query('DELETE FROM intentos_login WHERE correo = $1', [vigente.correo.toLowerCase()]);
        await cliente.query('COMMIT');
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
    res.json({ mensaje: 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.' });
}

module.exports = { solicitar, verificar, restablecer };

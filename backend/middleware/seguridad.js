// Ep7-Hu2: protección de la información clínica en tránsito.
//  - CORS limitado al dominio del frontend (variable FRONTEND_URL; varios dominios separados por coma).
//  - En producción: toda petición HTTP se redirige a HTTPS y se envía HSTS.
//  - Cabeceras de seguridad básicas (sin caché: los datos clínicos no deben quedar guardados en el navegador).
// Las variables se leen en cada petición para poder cambiarlas en las pruebas.

const esProduccion = () => process.env.NODE_ENV === 'production';

/** Dominios declarados en FRONTEND_URL, sin la barra final. */
function origenesDeclarados() {
    return (process.env.FRONTEND_URL || '')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);
}

/** Dominios que pueden llamar a la API. En desarrollo se añade el servidor de Vite. */
function origenesPermitidos() {
    const lista = origenesDeclarados();
    if (!esProduccion()) lista.push('http://localhost:5173', 'http://127.0.0.1:5173');
    return lista;
}

const protocoloDe = (req) => String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();

// Petición que el frontend hace a su propio dominio (el navegador envía Origin igual al host)
const esMismoOrigen = (req, origen) => origen === `${protocoloDe(req)}://${req.headers.host}`;

/** En producción solo se atiende por HTTPS; el proxy de la nube informa el protocolo en x-forwarded-proto. */
function forzarHttps(req, res, next) {
    if (!esProduccion()) return next();
    if (protocoloDe(req) !== 'https') {
        return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
}

/** CORS con lista blanca: nunca "*". Un origen no autorizado recibe 403. */
function cors(req, res, next) {
    const origen = req.headers.origin;
    if (!origen) return next(); // mismo origen sin cabecera, Postman, pruebas del servidor…
    res.vary('Origin');
    if (!origenesPermitidos().includes(origen)) {
        if (esMismoOrigen(req, origen)) return next();
        return res.status(403).json({ mensaje: 'Origen no permitido' });
    }
    res.setHeader('Access-Control-Allow-Origin', origen);
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
        return res.sendStatus(204);
    }
    next();
}

function cabeceras(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
}

/** Para Socket.IO (el chat): mismo criterio que CORS. */
function origenSocket(origen, callback) {
    callback(null, !origen || origenesPermitidos().includes(origen));
}

/** En producción el servidor no arranca con una configuración insegura. */
function verificarConfiguracion() {
    if (!esProduccion()) return;
    const problemas = [];
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        problemas.push('JWT_SECRET debe tener al menos 32 caracteres');
    }
    const declarados = origenesDeclarados();
    if (declarados.length === 0) problemas.push('falta FRONTEND_URL (dominio https del frontend)');
    else if (declarados.some((o) => !o.startsWith('https://'))) problemas.push('FRONTEND_URL debe usar https://');
    if (problemas.length) throw new Error(`Configuración insegura para producción: ${problemas.join('; ')}`);
}

module.exports = {
    middlewares: [forzarHttps, cors, cabeceras],
    origenSocket,
    origenesPermitidos,
    verificarConfiguracion,
};

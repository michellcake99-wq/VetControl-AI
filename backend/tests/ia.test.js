// Ep6-Hu1: endpoint del asistente de IA. El servicio externo se simula (no se gastan consultas reales).
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, carlos, vet;
const fetchOriginal = global.fetch;

/** Simula una respuesta del servicio de IA (formato chat/completions). */
function simularIA({ estado = 200, contenido = 'Respuesta de prueba', cuerpo } = {}) {
    const fn = jest.fn(async () => ({
        ok: estado >= 200 && estado < 300,
        status: estado,
        json: async () => cuerpo ?? { model: 'modelo-prueba', choices: [{ message: { content: contenido } }] },
    }));
    global.fetch = fn;
    return fn;
}

const interacciones = async (correo) => (await pool.query(
    `SELECT i.* FROM interacciones_ia i JOIN usuarios u USING (id_usuario) WHERE u.correo = $1 ORDER BY id_interaccion`,
    [correo]
)).rows;

beforeAll(async () => {
    await reiniciarBase();
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
});
beforeEach(() => {
    process.env.IA_API_KEY = 'clave-de-prueba';
    process.env.IA_LIMITE_CONSULTAS = '20';
});
afterEach(() => {
    global.fetch = fetchOriginal;
    delete process.env.IA_TIEMPO_MAXIMO_MS;
});
afterAll(() => pool.end());

describe('Seguridad y validación', () => {
    test('exige token JWT válido', async () => {
        expect((await request(app).post('/api/ia/consultar').send({ pregunta: 'Hola' })).status).toBe(401);
    });

    test('valida la pregunta', async () => {
        simularIA();
        const r = await ana.post('/api/ia/consultar', { pregunta: ' ' });
        expect(r.status).toBe(400);
        expect(r.body.detalles[0].campo).toBe('pregunta');
    });

    test('no permite preguntar por una mascota ajena', async () => {
        const fetch = simularIA();
        // Mascota 3 = Rocky, de Carlos
        expect((await ana.post('/api/ia/consultar', { pregunta: '¿Qué vacunas le faltan?', id_mascota: 3 })).status).toBe(403);
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe('Consulta correcta', () => {
    test('responde y guarda la interacción con usuario, pregunta, respuesta y fecha', async () => {
        const fetch = simularIA({ contenido: 'Dale agua fresca y sombra.' });
        const r = await ana.post('/api/ia/consultar', { pregunta: '¿Cómo cuido a mi perro del calor?' });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ respuesta: 'Dale agua fresca y sombra.', modelo: 'modelo-prueba' });
        expect(r.body.consultas_restantes).toBe(19);

        // Se llama al servicio con la clave del .env, nunca escrita en el código
        const [url, opciones] = fetch.mock.calls[0];
        expect(url).toMatch(/\/chat\/completions$/);
        expect(opciones.headers.Authorization).toBe('Bearer clave-de-prueba');

        const [guardada] = await interacciones('ana@correo.com');
        expect(guardada).toMatchObject({
            pregunta: '¿Cómo cuido a mi perro del calor?', respuesta: 'Dale agua fresca y sombra.', exitosa: true,
        });
        expect(guardada.fecha).toBeInstanceOf(Date);
    });

    test('con mascota: envía solo los datos de esa mascota como contexto', async () => {
        const fetch = simularIA();
        const r = await ana.post('/api/ia/consultar', { pregunta: 'Resume su estado', id_mascota: 1 });
        expect(r.status).toBe(200);
        const mensajes = JSON.parse(fetch.mock.calls[0][1].body).messages;
        const contexto = mensajes.find((m) => m.content.startsWith('Datos de la mascota')).content;
        expect(contexto).toContain('Max');
        expect(contexto).toContain('Rabia');
        expect(contexto).not.toContain('Luna');
        expect(mensajes.at(-1)).toEqual({ role: 'user', content: 'Resume su estado' });
    });

    test('el veterinario puede consultar sobre cualquier mascota', async () => {
        simularIA();
        expect((await vet.post('/api/ia/consultar', { pregunta: 'Antecedentes de Rocky', id_mascota: 3 })).status).toBe(200);
    });
});

describe('Errores del servicio (sin detener el servidor)', () => {
    test('error del proveedor -> 502 con mensaje claro, y queda registrado', async () => {
        simularIA({ estado: 500, cuerpo: { error: { message: 'internal' } } });
        const r = await carlos.post('/api/ia/consultar', { pregunta: '¿Qué come un bulldog?' });
        expect(r.status).toBe(502);
        expect(r.body.mensaje).toMatch(/servicio de IA/);
        const [fallida] = await interacciones('carlos@correo.com');
        expect(fallida).toMatchObject({ exitosa: false, respuesta: null });
        expect(fallida.error).toContain('HTTP 500');
    });

    test('el proveedor está saturado (429) -> 503', async () => {
        simularIA({ estado: 429, cuerpo: { error: { message: 'rate limit' } } });
        expect((await carlos.post('/api/ia/consultar', { pregunta: 'Hola, ¿cómo estás?' })).status).toBe(503);
    });

    test('tiempo de espera agotado -> 504', async () => {
        process.env.IA_TIEMPO_MAXIMO_MS = '50';
        global.fetch = jest.fn((_url, { signal }) => new Promise((_resolver, rechazar) => {
            signal.addEventListener('abort', () => rechazar(signal.reason));
        }));
        const r = await carlos.post('/api/ia/consultar', { pregunta: '¿Por qué mi perro bosteza?' });
        expect(r.status).toBe(504);
        expect(r.body.mensaje).toMatch(/tardó demasiado/);
    });

    test('sin clave configurada -> 503 y no llama al servicio', async () => {
        delete process.env.IA_API_KEY;
        const fetch = simularIA();
        const r = await carlos.post('/api/ia/consultar', { pregunta: '¿Cada cuánto lo baño?' });
        expect(r.status).toBe(503);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('después de los errores el servidor sigue respondiendo', async () => {
        simularIA();
        expect((await carlos.post('/api/ia/consultar', { pregunta: '¿Sigues ahí?' })).status).toBe(200);
    });
});

describe('Límite de consultas por usuario', () => {
    test('al pasar el límite responde 429 y no llama al servicio', async () => {
        process.env.IA_LIMITE_CONSULTAS = '2';
        const nueva = api(await iniciarSesion('marta@correo.com'));
        simularIA();
        expect((await nueva.post('/api/ia/consultar', { pregunta: 'Pregunta 1' })).status).toBe(200);
        expect((await nueva.post('/api/ia/consultar', { pregunta: 'Pregunta 2' })).status).toBe(200);

        const fetch = simularIA();
        const r = await nueva.post('/api/ia/consultar', { pregunta: 'Pregunta 3' });
        expect(r.status).toBe(429);
        expect(r.body.mensaje).toMatch(/límite de 2 consultas/);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('el límite es por usuario: otro usuario sigue pudiendo consultar', async () => {
        process.env.IA_LIMITE_CONSULTAS = '2';
        simularIA();
        expect((await vet.post('/api/ia/consultar', { pregunta: 'Pregunta del veterinario' })).status).toBe(200);
    });
});
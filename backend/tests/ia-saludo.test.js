// Lote C: la IA conoce el nombre y el rol de quien le escribe para saludarlo y adaptar el tono
const { pool, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, laura, admin;
const fetchOriginal = global.fetch;

function simularIA() {
    global.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ model: 'modelo-prueba', choices: [{ message: { content: 'Hola' } }] }),
    }));
}

/** Mensajes de sistema que recibió la IA en la última llamada. */
function sistemaEnviado() {
    const cuerpo = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
    return cuerpo.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
}

beforeAll(async () => {
    await reiniciarBase();
    ana = api(await iniciarSesion('ana@correo.com'));
    laura = api(await iniciarSesion('vet@vetcontrol.com'));
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
});
beforeEach(() => {
    process.env.IA_API_KEY = 'clave-de-prueba';
    process.env.IA_LIMITE_CONSULTAS = '50';
    simularIA();
});
afterEach(() => {
    global.fetch = fetchOriginal;
});
afterAll(async () => {
    delete process.env.IA_LIMITE_CONSULTAS;
    await pool.end();
});

describe('POST /api/ia/consultar — trato según el usuario', () => {
    test('a un propietario se le indica su nombre y un trato cercano', async () => {
        const r = await ana.post('/api/ia/consultar', { pregunta: 'hola' });
        expect(r.status).toBe(200);
        const sistema = sistemaEnviado();
        expect(sistema).toContain('se llama Ana');
        expect(sistema).toContain('"propietario"');
        expect(sistema).toContain('dueño de una mascota');
    });

    test('a un veterinario se le trata como colega', async () => {
        await laura.post('/api/ia/consultar', { pregunta: 'hola' });
        const sistema = sistemaEnviado();
        expect(sistema).toContain('se llama Laura');
        expect(sistema).toContain('"veterinario"');
        expect(sistema).toContain('colega');
    });

    test('al administrador se le habla de la plataforma', async () => {
        await admin.post('/api/ia/consultar', { pregunta: 'hola' });
        const sistema = sistemaEnviado();
        expect(sistema).toContain('se llama Admin');
        expect(sistema).toContain('"administrador"');
    });

    test('las instrucciones base y la pregunta siguen en la llamada', async () => {
        await ana.post('/api/ia/consultar', { pregunta: '¿cada cuánto se desparasita un gato?' });
        const cuerpo = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
        expect(cuerpo.messages[0].content).toContain('asistente de VetControl AI');
        expect(cuerpo.messages.at(-1)).toEqual({ role: 'user', content: '¿cada cuánto se desparasita un gato?' });
    });
});

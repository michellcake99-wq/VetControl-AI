// Ep6-Hu3: pantalla del asistente de IA — consultas restantes y aviso en cada respuesta
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, carlos, marta;
const fetchOriginal = global.fetch;

function simularIA({ estado = 200, contenido = 'Respuesta de prueba' } = {}) {
    global.fetch = jest.fn(async () => ({
        ok: estado >= 200 && estado < 300,
        status: estado,
        json: async () => ({ model: 'modelo-prueba', choices: [{ message: { content: contenido } }] }),
    }));
}

beforeAll(async () => {
    await reiniciarBase();
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
    marta = api(await iniciarSesion('marta@correo.com'));
});
beforeEach(() => {
    process.env.IA_API_KEY = 'clave-de-prueba';
    process.env.IA_LIMITE_CONSULTAS = '5';
    process.env.IA_VENTANA_MINUTOS = '60';
});
afterEach(() => {
    global.fetch = fetchOriginal;
});
afterAll(async () => {
    delete process.env.IA_LIMITE_CONSULTAS;
    delete process.env.IA_VENTANA_MINUTOS;
    await pool.end();
});

describe('GET /api/ia/cupo', () => {
    test('exige token', async () => {
        expect((await request(app).get('/api/ia/cupo')).status).toBe(401);
    });

    test('un usuario nuevo tiene todas sus consultas disponibles', async () => {
        const r = await ana.get('/api/ia/cupo');
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ limite: 5, ventana_minutos: 60, usadas: 0, restantes: 5, minutos_para_nueva: null });
    });

    test('baja con cada consulta y coincide con lo que responde el asistente', async () => {
        simularIA();
        const primera = await carlos.post('/api/ia/consultar', { pregunta: '¿Qué come un bulldog?' });
        expect(primera.body.consultas_restantes).toBe(4);
        expect((await carlos.get('/api/ia/cupo')).body).toMatchObject({ usadas: 1, restantes: 4 });

        // El resumen de la historia también cuenta
        const resumen = await carlos.post('/api/ia/resumir-historial', { id_mascota: 3 });
        expect(resumen.body.consultas_restantes).toBe(3);
        expect((await carlos.get('/api/ia/cupo')).body).toMatchObject({ usadas: 2, restantes: 3 });
    });

    test('las consultas que fallan también cuentan', async () => {
        simularIA({ estado: 500 });
        expect((await marta.post('/api/ia/consultar', { pregunta: 'Esto falla' })).status).toBe(502);
        expect((await marta.get('/api/ia/cupo')).body).toMatchObject({ usadas: 1, restantes: 4 });
    });

    test('al agotarse indica en cuántos minutos podrá consultar de nuevo', async () => {
        process.env.IA_LIMITE_CONSULTAS = '2';
        const r = await carlos.get('/api/ia/cupo');
        expect(r.body).toMatchObject({ limite: 2, usadas: 2, restantes: 0 });
        expect(r.body.minutos_para_nueva).toBeGreaterThanOrEqual(1);
        expect(r.body.minutos_para_nueva).toBeLessThanOrEqual(60);

        simularIA();
        const bloqueada = await carlos.post('/api/ia/consultar', { pregunta: 'Una más' });
        expect(bloqueada.status).toBe(429);
        expect(bloqueada.body.mensaje).toMatch(/límite de 2 consultas/);
    });

    test('es por usuario: no se mezcla con el de otra persona', async () => {
        expect((await ana.get('/api/ia/cupo')).body).toMatchObject({ usadas: 0, restantes: 5 });
    });

    test('el cupo vuelve a liberarse cuando las consultas salen de la ventana', async () => {
        await pool.query(`UPDATE interacciones_ia SET fecha = now() - interval '2 hours'`);
        expect((await carlos.get('/api/ia/cupo')).body).toMatchObject({ usadas: 0, restantes: 5, minutos_para_nueva: null });
    });
});

describe('Aviso de que la respuesta la generó una IA', () => {
    test('cada respuesta del asistente trae el aviso', async () => {
        simularIA({ contenido: 'Cada tres meses.' });
        const r = await ana.post('/api/ia/consultar', { pregunta: '¿Cada cuánto desparasito?', id_mascota: 1 });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ respuesta: 'Cada tres meses.' });
        expect(r.body.aviso).toMatch(/inteligencia artificial.*no reemplaza el criterio del veterinario/);
    });
});

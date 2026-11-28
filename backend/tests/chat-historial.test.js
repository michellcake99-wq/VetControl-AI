// Ep8-Hu3: consulta del historial de conversaciones
const { pool, reiniciarBase, iniciarSesion, api, request, app } = require('./helpers');

let ana, carlos, vet, vet2;
let conMax, conLuna, conVacia; // conversaciones de Ana
const ANA = 4;   // id_usuario de Ana
const VET = 2;   // id_usuario del veterinario 1

beforeAll(async () => {
    await reiniciarBase();
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
    vet2 = api(await iniciarSesion('vet2@vetcontrol.com'));
    conMax = (await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 1 })).body.id_conversacion;
    conLuna = (await ana.post('/api/conversaciones', { id_veterinario: 2, id_mascota: 2 })).body.id_conversacion;
});
afterAll(() => pool.end());

// Inserta n mensajes alternando remitente, con fechas crecientes (1 minuto entre uno y otro)
async function llenar(idConversacion, n) {
    await pool.query(
        `INSERT INTO mensajes (id_conversacion, id_remitente, contenido, fecha_envio)
         SELECT $1, CASE WHEN g % 2 = 1 THEN $2::int ELSE $3::int END, 'Mensaje ' || g,
                now() - interval '2 days' + (g || ' minutes')::interval
           FROM generate_series(1, $4::int) g`,
        [idConversacion, ANA, VET, n]
    );
}
const pagina = (idCon, qs = '', cliente = ana) => cliente.get(`/api/conversaciones/${idCon}/mensajes${qs}`);
const textos = (r) => r.body.datos.map((m) => m.contenido);

describe('Criterio 1: lista de conversaciones', () => {
    test('muestra la otra persona, la mascota, el último mensaje y su fecha, de la más reciente a la más antigua', async () => {
        await pool.query(
            `INSERT INTO mensajes (id_conversacion, id_remitente, contenido, fecha_envio) VALUES
             ($1, $3, 'Max sigue igual', now() - interval '3 hours'),
             ($1, $4, 'Revisemos mañana', now() - interval '2 hours'),
             ($2, $3, 'Luna ya come bien', now() - interval '10 minutes')`,
            [conMax, conLuna, ANA, VET]
        );
        const r = await ana.get('/api/conversaciones');
        expect(r.status).toBe(200);
        expect(r.body.map((c) => c.id_conversacion)).toEqual([conLuna, conMax]);
        expect(r.body[0]).toMatchObject({ nombre_mascota: 'Luna', ultimo_mensaje: { contenido: 'Luna ya come bien', id_remitente: ANA } });
        expect(r.body[1]).toMatchObject({ nombre_mascota: 'Max', nombre_contacto: 'Laura Quintero', ultimo_mensaje: { contenido: 'Revisemos mañana', id_remitente: VET } });
        for (const c of r.body) expect(Number.isNaN(Date.parse(c.ultimo_mensaje.fecha_envio))).toBe(false);
        expect(new Date(r.body[0].ultimo_mensaje.fecha_envio) > new Date(r.body[1].ultimo_mensaje.fecha_envio)).toBe(true);
    });

    test('el veterinario ve a su propietario y la mascota; una conversación sin mensajes no tiene último mensaje', async () => {
        conVacia = (await carlos.post('/api/conversaciones', { id_veterinario: 1 })).body.id_conversacion;
        const r = await vet.get('/api/conversaciones');
        expect(r.body.find((c) => c.id_conversacion === conMax)).toMatchObject({ nombre_contacto: 'Ana Torres', nombre_mascota: 'Max' });
        expect(r.body.find((c) => c.id_conversacion === conVacia).ultimo_mensaje).toBeNull();
    });

    test('una conversación nueva sin mensajes se ordena por su fecha de creación', async () => {
        const r = await vet.get('/api/conversaciones');
        const ids = r.body.map((c) => c.id_conversacion);
        expect(ids.indexOf(conVacia)).toBeLessThan(ids.indexOf(conMax)); // creada hace segundos, más reciente que el mensaje de hace 2 h
    });
});

describe('Criterio 2: mensajes anteriores por páginas, en orden cronológico', () => {
    beforeAll(async () => {
        await pool.query('DELETE FROM mensajes WHERE id_conversacion = $1', [conMax]);
        await llenar(conMax, 75);
    });

    test('al abrir carga los 30 más recientes, de más antiguo a más reciente, e indica que hay más', async () => {
        const r = await pagina(conMax);
        expect(r.status).toBe(200);
        expect(r.body.hay_mas).toBe(true);
        expect(r.body.datos).toHaveLength(30);
        expect(textos(r)[0]).toBe('Mensaje 46');
        expect(textos(r)[29]).toBe('Mensaje 75');
    });

    test('con «antes» carga los anteriores sin repetir ni saltarse ninguno hasta el primero', async () => {
        let r = await pagina(conMax);
        let todos = r.body.datos;
        const paginas = [r.body.datos.length];
        while (r.body.hay_mas) {
            r = await pagina(conMax, `?antes=${todos[0].id_mensaje}`);
            expect(r.status).toBe(200);
            paginas.push(r.body.datos.length);
            todos = [...r.body.datos, ...todos];
        }
        expect(paginas).toEqual([30, 30, 15]);
        expect(todos.map((m) => m.contenido)).toEqual(Array.from({ length: 75 }, (_, i) => `Mensaje ${i + 1}`));
        expect(r.body.hay_mas).toBe(false);
    });

    test('«limite» cambia el tamaño de la página', async () => {
        const r = await pagina(conMax, '?limite=5');
        expect(textos(r)).toEqual(['Mensaje 71', 'Mensaje 72', 'Mensaje 73', 'Mensaje 74', 'Mensaje 75']);
        expect(r.body.hay_mas).toBe(true);
    });

    test('una conversación corta cabe en una sola página', async () => {
        await pool.query('DELETE FROM mensajes WHERE id_conversacion = $1', [conLuna]);
        await llenar(conLuna, 3);
        const r = await pagina(conLuna);
        expect(textos(r)).toEqual(['Mensaje 1', 'Mensaje 2', 'Mensaje 3']);
        expect(r.body.hay_mas).toBe(false);
    });

    test('exactamente un límite de mensajes no marca «hay más»', async () => {
        const r = await pagina(conLuna, '?limite=3');
        expect(r.body.datos).toHaveLength(3);
        expect(r.body.hay_mas).toBe(false);
    });

    test('mensajes con la misma fecha no se pierden al paginar', async () => {
        const { rows } = await pool.query(
            `INSERT INTO mensajes (id_conversacion, id_remitente, contenido, fecha_envio)
             SELECT $1, $2, 'Igual ' || g, now() + interval '1 hour' FROM generate_series(1, 7) g RETURNING id_mensaje`,
            [conLuna, ANA]
        );
        let r = await pagina(conLuna, '?limite=3');
        let todos = r.body.datos;
        while (r.body.hay_mas) {
            r = await pagina(conLuna, `?limite=3&antes=${todos[0].id_mensaje}`);
            todos = [...r.body.datos, ...todos];
        }
        expect(todos).toHaveLength(10);
        expect(new Set(todos.map((m) => m.id_mensaje)).size).toBe(10);
        expect(todos.slice(3).map((m) => m.id_mensaje)).toEqual(rows.map((x) => x.id_mensaje).sort((a, b) => a - b));
    });

    test('un mensaje enviado después aparece en la primera página sin alterar las anteriores', async () => {
        await pool.query("INSERT INTO mensajes (id_conversacion, id_remitente, contenido) VALUES ($1, $2, 'Nuevo')", [conMax, VET]);
        const r = await pagina(conMax);
        expect(textos(r).at(-1)).toBe('Nuevo');
        expect(r.body.datos).toHaveLength(30);
    });

    test('el veterinario también puede leer el historial', async () => {
        const r = await pagina(conMax, '?limite=2', vet);
        expect(r.status).toBe(200);
        expect(r.body.datos).toHaveLength(2);
    });

    test('una conversación sin mensajes devuelve una lista vacía', async () => {
        const r = await pagina(conVacia, '', carlos);
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ datos: [], hay_mas: false });
    });

    test.each([
        ['limite=0'], ['limite=101'], ['limite=abc'], ['limite=2.5'], ['antes=abc'], ['antes=-4'], ['antes=0'],
    ])('rechaza parámetros inválidos (%s) con 400', async (qs) => {
        expect((await pagina(conMax, `?${qs}`)).status).toBe(400);
    });

    test('«antes» con un mensaje de otra conversación responde 400 y no filtra datos', async () => {
        const ajeno = (await pool.query('SELECT id_mensaje FROM mensajes WHERE id_conversacion = $1 LIMIT 1', [conLuna])).rows[0].id_mensaje;
        const r = await pagina(conMax, `?antes=${ajeno}`);
        expect(r.status).toBe(400);
        expect(r.body.datos).toBeUndefined();
        expect((await pagina(conMax, '?antes=999999')).status).toBe(400);
    });
});

describe('Criterio 3: solo los participantes ven la conversación', () => {
    test('otro propietario y otro veterinario reciben 403, también con paginación', async () => {
        for (const qs of ['', '?limite=5']) {
            expect((await pagina(conMax, qs, carlos)).status).toBe(403);
            expect((await pagina(conMax, qs, vet2)).status).toBe(403);
        }
    });

    test('una conversación inexistente responde 404 y sin sesión 401', async () => {
        expect((await pagina(9999)).status).toBe(404);
        expect((await request(app).get(`/api/conversaciones/${conMax}/mensajes`)).status).toBe(401);
    });

    test('la lista solo incluye las conversaciones del propio usuario', async () => {
        const ids = (await carlos.get('/api/conversaciones')).body.map((c) => c.id_conversacion);
        expect(ids).toEqual([conVacia]);
        expect((await vet2.get('/api/conversaciones')).body.map((c) => c.id_conversacion)).toEqual([conLuna]);
    });
});

describe('Criterio 4: sin conversaciones', () => {
    test('la lista sale vacía para quien no tiene conversaciones', async () => {
        const r = await api(await iniciarSesion('marta@correo.com')).get('/api/conversaciones');
        expect(r.status).toBe(200);
        expect(r.body).toEqual([]);
    });
});

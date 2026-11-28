// Ep8-Hu1: envío de mensajes entre propietario y veterinario
const http = require('http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const { app, pool, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { iniciarChat } = require('../sockets/chat');

let servidor, url;
let tokens = {};
let vet, vet2, admin, ana, carlos;
const sockets = [];

/** Abre un socket con el token indicado y espera a que conecte (o falle). */
function abrirSocket(token) {
    return new Promise((resolve, reject) => {
        const s = conectar(url, { auth: { token }, reconnection: false, forceNew: true });
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}

const enviar = (socket, datos) => socket.timeout(2000).emitWithAck('enviar_mensaje', datos);

beforeAll(async () => {
    await reiniciarBase();
    for (const correo of ['vet@vetcontrol.com', 'vet2@vetcontrol.com', 'admin@vetcontrol.com', 'ana@correo.com', 'carlos@correo.com']) {
        tokens[correo] = await iniciarSesion(correo);
    }
    vet = api(tokens['vet@vetcontrol.com']);           // id_veterinario 1 (Laura)
    vet2 = api(tokens['vet2@vetcontrol.com']);         // id_veterinario 2
    admin = api(tokens['admin@vetcontrol.com']);
    ana = api(tokens['ana@correo.com']);               // dueña de Max (1) y Luna (2)
    carlos = api(tokens['carlos@correo.com']);         // dueño de Rocky (3)

    servidor = http.createServer(app);
    iniciarChat(new Server(servidor));
    await new Promise((r) => servidor.listen(0, r));
    url = `http://localhost:${servidor.address().port}`;
});

afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await new Promise((r) => servidor.close(r));
    await pool.end();
});

describe('Conversaciones (REST)', () => {
    let idConMax;

    test('el propietario ve la lista de veterinarios disponibles para escribir', async () => {
        const r = await ana.get('/api/conversaciones/veterinarios');
        expect(r.status).toBe(200);
        expect(r.body).toEqual(expect.arrayContaining([
            expect.objectContaining({ id_veterinario: 1, nombre: 'Laura', apellido: 'Quintero' }),
        ]));
    });

    test('el propietario inicia una conversación asociada a su mascota (y no se duplica)', async () => {
        const r = await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 1 });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ id_veterinario: 1, id_mascota: 1, id_propietario: 1 });
        idConMax = r.body.id_conversacion;

        const otra = await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 1 });
        expect(otra.status).toBe(200);
        expect(otra.body.id_conversacion).toBe(idConMax);
    });

    test('la mascota es opcional y tampoco se duplica la conversación sin mascota', async () => {
        const r = await ana.post('/api/conversaciones', { id_veterinario: 1 });
        expect(r.status).toBe(201);
        expect(r.body.id_mascota).toBeNull();
        expect(r.body.id_conversacion).not.toBe(idConMax);
        const otra = await ana.post('/api/conversaciones', { id_veterinario: 1 });
        expect(otra.body.id_conversacion).toBe(r.body.id_conversacion);
    });

    test('no puede asociar una mascota ajena ni escribir a un veterinario inexistente', async () => {
        expect((await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 3 })).status).toBe(403);
        expect((await ana.post('/api/conversaciones', { id_veterinario: 99 })).status).toBe(404);
        expect((await ana.post('/api/conversaciones', {})).status).toBe(400);
    });

    test('solo el propietario inicia conversaciones', async () => {
        expect((await vet.post('/api/conversaciones', { id_veterinario: 1 })).status).toBe(403);
        expect((await admin.post('/api/conversaciones', { id_veterinario: 1 })).status).toBe(403);
    });

    test('cada participante ve sus conversaciones con el nombre de la otra persona', async () => {
        const deAna = await ana.get('/api/conversaciones');
        expect(deAna.status).toBe(200);
        expect(deAna.body).toHaveLength(2);
        expect(deAna.body[0]).toMatchObject({ nombre_contacto: 'Laura Quintero' });

        const delVet = await vet.get('/api/conversaciones');
        expect(delVet.body.find((c) => c.id_conversacion === idConMax))
            .toMatchObject({ nombre_contacto: 'Ana Torres', nombre_mascota: 'Max' });

        expect((await vet2.get('/api/conversaciones')).body).toHaveLength(0);
        expect((await carlos.get('/api/conversaciones')).body).toHaveLength(0);
    });

    test('nadie fuera de la conversación puede leer sus mensajes', async () => {
        expect((await ana.get(`/api/conversaciones/${idConMax}/mensajes`)).status).toBe(200);
        expect((await carlos.get(`/api/conversaciones/${idConMax}/mensajes`)).status).toBe(403);
        expect((await vet2.get(`/api/conversaciones/${idConMax}/mensajes`)).status).toBe(403);
        expect((await ana.get('/api/conversaciones/999/mensajes')).status).toBe(404);
    });

    test('requiere token', async () => {
        const { request } = require('./helpers');
        expect((await request(app).get('/api/conversaciones')).status).toBe(401);
    });
});

describe('Envío de mensajes (Socket.IO)', () => {
    let sAna, sVet, idCon;

    beforeAll(async () => {
        idCon = (await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 1 })).body.id_conversacion;
        sAna = await abrirSocket(tokens['ana@correo.com']);
        sVet = await abrirSocket(tokens['vet@vetcontrol.com']);
    });

    test('rechaza la conexión sin token o con un token inválido', async () => {
        await expect(abrirSocket(undefined)).rejects.toThrow(/token/i);
        await expect(abrirSocket('token-falso')).rejects.toThrow(/token/i);
    });

    test('el propietario envía un mensaje y queda guardado con remitente, contenido y fecha', async () => {
        const ack = await enviar(sAna, { id_conversacion: idCon, contenido: '  Hola, Max no quiere comer  ' });
        expect(ack.mensaje).toMatchObject({ id_conversacion: idCon, contenido: 'Hola, Max no quiere comer' });

        const { rows } = await pool.query('SELECT * FROM mensajes WHERE id_mensaje = $1', [ack.mensaje.id_mensaje]);
        expect(rows[0]).toMatchObject({ id_remitente: 4, contenido: 'Hola, Max no quiere comer' });
        expect(rows[0].fecha_envio).toBeInstanceOf(Date);
    });

    test('el veterinario puede responder y ambos ven la conversación completa', async () => {
        const ack = await enviar(sVet, { id_conversacion: idCon, contenido: '¿Desde cuándo?' });
        expect(ack.error).toBeUndefined();
        expect(ack.mensaje.id_remitente).toBe(2);

        const historial = await ana.get(`/api/conversaciones/${idCon}/mensajes`);
        expect(historial.body.datos.map((m) => m.contenido)).toEqual(['Hola, Max no quiere comer', '¿Desde cuándo?']);
    });

    test('no se envían mensajes vacíos ni de más de 1000 caracteres', async () => {
        expect((await enviar(sAna, { id_conversacion: idCon, contenido: '   ' })).error).toMatch(/vac/i);
        expect((await enviar(sAna, { id_conversacion: idCon, contenido: 'a'.repeat(1001) })).error).toMatch(/1000/);
        expect((await enviar(sAna, { id_conversacion: idCon, contenido: 'a'.repeat(1000) })).mensaje).toBeDefined();
    });

    test('nadie fuera de la conversación puede escribir en ella', async () => {
        const sCarlos = await abrirSocket(tokens['carlos@correo.com']);
        expect((await enviar(sCarlos, { id_conversacion: idCon, contenido: 'hola' })).error).toMatch(/permiso/i);
        expect((await enviar(sCarlos, { id_conversacion: 999, contenido: 'hola' })).error).toMatch(/no encontrad/i);
    });
});

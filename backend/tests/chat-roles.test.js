// Ep8-Hu5: restricción de la comunicación según el rol del usuario
const http = require('http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const { app, pool, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { iniciarChat } = require('../sockets/chat');

let servidor, url;
const tokens = {};
const sockets = [];

function abrirSocket(token) {
    return new Promise((resolve, reject) => {
        const s = conectar(url, { auth: { token }, reconnection: false, forceNew: true });
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}
const enviar = (socket, datos) => socket.timeout(2000).emitWithAck('enviar_mensaje', datos);
const contarMensajes = async (idCon) =>
    (await pool.query('SELECT count(*)::int AS n FROM mensajes WHERE id_conversacion = $1', [idCon])).rows[0].n;
const activar = (correo, activo) => pool.query('UPDATE usuarios SET activo = $1 WHERE correo = $2', [activo, correo]);

beforeAll(async () => {
    await reiniciarBase();
    for (const correo of ['vet@vetcontrol.com', 'vet2@vetcontrol.com', 'admin@vetcontrol.com', 'ana@correo.com', 'carlos@correo.com']) {
        tokens[correo] = await iniciarSesion(correo);
    }
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

describe('Solo propietario <-> veterinario', () => {
    test('el administrador no puede usar el chat (403)', async () => {
        const admin = api(tokens['admin@vetcontrol.com']);
        expect((await admin.get('/api/conversaciones')).status).toBe(403);
        expect((await admin.get('/api/conversaciones/veterinarios')).status).toBe(403);
        expect((await admin.get('/api/conversaciones/1/mensajes')).status).toBe(403);
        expect((await admin.post('/api/conversaciones', { id_veterinario: 1 })).status).toBe(403);
    });

    test('el administrador no puede conectarse al chat en tiempo real', async () => {
        await expect(abrirSocket(tokens['admin@vetcontrol.com'])).rejects.toThrow(/propietarios y veterinarios/);
    });

    test('un veterinario no inicia conversaciones ni lista a otros veterinarios (no hay chat entre colegas)', async () => {
        const vet = api(tokens['vet@vetcontrol.com']);
        expect((await vet.post('/api/conversaciones', { id_veterinario: 2 })).status).toBe(403);
        expect((await vet.get('/api/conversaciones/veterinarios')).status).toBe(403);
    });

    test('un propietario solo puede escribirle a veterinarios (no a otro propietario)', async () => {
        const ana = api(tokens['ana@correo.com']);
        // El destinatario siempre es un id_veterinario; el id de un usuario propietario no sirve
        expect((await ana.post('/api/conversaciones', { id_veterinario: 5 })).status).toBe(404);
        const veterinarios = (await ana.get('/api/conversaciones/veterinarios')).body;
        expect(veterinarios.every((v) => v.id_veterinario)).toBe(true);
    });
});

describe('Solo veterinarios activos', () => {
    let idConVet2;

    beforeAll(async () => {
        const ana = api(tokens['ana@correo.com']);
        idConVet2 = (await ana.post('/api/conversaciones', { id_veterinario: 2 })).body.id_conversacion;
    });

    afterAll(() => activar('vet2@vetcontrol.com', true));

    test('al desactivar al veterinario ya no aparece ni se puede abrir conversación con él', async () => {
        await activar('vet2@vetcontrol.com', false);
        const ana = api(tokens['ana@correo.com']);
        const lista = (await ana.get('/api/conversaciones/veterinarios')).body;
        expect(lista.find((v) => v.id_veterinario === 2)).toBeUndefined();
        expect((await ana.post('/api/conversaciones', { id_veterinario: 2 })).status).toBe(404);
    });

    test('un mensaje a un veterinario desactivado se rechaza con 403 y no se guarda', async () => {
        const sAna = await abrirSocket(tokens['ana@correo.com']);
        const antes = await contarMensajes(idConVet2);
        const ack = await enviar(sAna, { id_conversacion: idConVet2, contenido: 'Hola' });
        expect(ack).toMatchObject({ estado: 403, error: expect.stringMatching(/no está activo/) });
        expect(await contarMensajes(idConVet2)).toBe(antes);
    });
});

describe('Validación en cada evento de Socket.IO', () => {
    let idCon;

    beforeAll(async () => {
        const ana = api(tokens['ana@correo.com']);
        idCon = (await ana.post('/api/conversaciones', { id_veterinario: 1 })).body.id_conversacion;
    });

    afterAll(() => activar('ana@correo.com', true));

    test('si la cuenta se desactiva estando conectada, el siguiente mensaje se rechaza (403) y no se guarda', async () => {
        const sAna = await abrirSocket(tokens['ana@correo.com']);
        expect((await enviar(sAna, { id_conversacion: idCon, contenido: 'primero' })).mensaje).toBeDefined();

        await activar('ana@correo.com', false);
        const antes = await contarMensajes(idCon);
        const ack = await enviar(sAna, { id_conversacion: idCon, contenido: 'segundo' });
        expect(ack).toMatchObject({ estado: 403 });
        expect(await contarMensajes(idCon)).toBe(antes);
    });

    test('quien no participa en la conversación recibe 403 y su mensaje no se guarda', async () => {
        await activar('ana@correo.com', true);
        const sCarlos = await abrirSocket(tokens['carlos@correo.com']);
        const sVet2 = await abrirSocket(tokens['vet2@vetcontrol.com']);
        const antes = await contarMensajes(idCon);
        expect(await enviar(sCarlos, { id_conversacion: idCon, contenido: 'intruso' })).toMatchObject({ estado: 403 });
        expect(await enviar(sVet2, { id_conversacion: idCon, contenido: 'intruso' })).toMatchObject({ estado: 403 });
        expect(await contarMensajes(idCon)).toBe(antes);
    });

    test('los participantes sí pueden escribir', async () => {
        const sVet = await abrirSocket(tokens['vet@vetcontrol.com']);
        expect((await enviar(sVet, { id_conversacion: idCon, contenido: 'Respuesta' })).mensaje).toBeDefined();
    });
});

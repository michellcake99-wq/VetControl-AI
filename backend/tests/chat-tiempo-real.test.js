// Ep8-Hu2: recepción de mensajes en tiempo real
const http = require('http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const { app, pool, request, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { iniciarChat } = require('../sockets/chat');

let servidor, url, ana, vet, vet2, carlos, tokens = {}, idCon;
const sockets = [];

function abrirSocket(token) {
    return new Promise((resolve, reject) => {
        const s = conectar(url, { auth: { token }, reconnection: false, forceNew: true });
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}
/** Espera el próximo evento `nombre` del socket (falla si tarda más de `ms`). */
const esperarEvento = (socket, nombre, ms = 2000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`No llegó "${nombre}" en ${ms} ms`)), ms);
    socket.once(nombre, (datos) => { clearTimeout(t); resolve(datos); });
});
/** Comprueba que NO llega ningún evento `nombre` durante `ms`. */
const noLlega = (socket, nombre, ms = 400) => new Promise((resolve, reject) => {
    const alRecibir = () => reject(new Error(`No debía llegar "${nombre}"`));
    socket.once(nombre, alRecibir);
    setTimeout(() => { socket.off(nombre, alRecibir); resolve(); }, ms);
});
const enviar = (socket, datos) => socket.timeout(2000).emitWithAck('enviar_mensaje', datos);
const delLista = async (cliente, id = idCon) => (await cliente.get('/api/conversaciones')).body.find((c) => c.id_conversacion === id);

beforeAll(async () => {
    await reiniciarBase();
    for (const correo of ['ana@correo.com', 'vet@vetcontrol.com', 'vet2@vetcontrol.com', 'carlos@correo.com']) {
        tokens[correo] = await iniciarSesion(correo);
    }
    ana = api(tokens['ana@correo.com']);
    vet = api(tokens['vet@vetcontrol.com']);
    vet2 = api(tokens['vet2@vetcontrol.com']);
    carlos = api(tokens['carlos@correo.com']);
    idCon = (await ana.post('/api/conversaciones', { id_veterinario: 1, id_mascota: 1 })).body.id_conversacion;

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

describe('Recepción al instante', () => {
    let sAna, sAna2, sVet, sCarlos;
    beforeAll(async () => {
        sAna = await abrirSocket(tokens['ana@correo.com']);
        sAna2 = await abrirSocket(tokens['ana@correo.com']);   // segunda pestaña de Ana
        sVet = await abrirSocket(tokens['vet@vetcontrol.com']);
        sCarlos = await abrirSocket(tokens['carlos@correo.com']);
    });

    test('el veterinario recibe el mensaje del propietario sin consultar nada', async () => {
        const llega = esperarEvento(sVet, 'nuevo_mensaje');
        const ack = await enviar(sAna, { id_conversacion: idCon, contenido: 'Max no quiere comer' });
        const recibido = await llega;
        expect(recibido).toEqual(ack.mensaje);
        expect(recibido).toMatchObject({ id_conversacion: idCon, id_remitente: 4, contenido: 'Max no quiere comer', leido: false });
        expect(recibido.fecha_envio).toBeDefined();
    });

    test('el propietario recibe la respuesta del veterinario', async () => {
        const llega = esperarEvento(sAna, 'nuevo_mensaje');
        await enviar(sVet, { id_conversacion: idCon, contenido: '¿Desde cuándo?' });
        expect(await llega).toMatchObject({ id_remitente: 2, contenido: '¿Desde cuándo?' });
    });

    test('las otras pestañas del remitente también ven su mensaje', async () => {
        const llega = esperarEvento(sAna2, 'nuevo_mensaje');
        await enviar(sAna, { id_conversacion: idCon, contenido: 'Desde ayer' });
        expect(await llega).toMatchObject({ contenido: 'Desde ayer' });
    });

    test('nadie ajeno a la conversación recibe el mensaje', async () => {
        const sinLlegar = noLlega(sCarlos, 'nuevo_mensaje');
        await enviar(sAna, { id_conversacion: idCon, contenido: 'Esto es privado' });
        await sinLlegar;
    });

    test('un mensaje rechazado no se entrega a nadie', async () => {
        const sinLlegar = noLlega(sVet, 'nuevo_mensaje');
        expect((await enviar(sAna, { id_conversacion: idCon, contenido: '   ' })).error).toBeDefined();
        expect((await enviar(sCarlos, { id_conversacion: idCon, contenido: 'intruso' })).error).toMatch(/permiso/i);
        await sinLlegar;
    });

    test('los mensajes llegan en el orden en que se enviaron', async () => {
        const recibidos = [];
        const alRecibir = (m) => recibidos.push(m.contenido);
        sVet.on('nuevo_mensaje', alRecibir);
        for (const n of [1, 2, 3, 4]) await enviar(sAna, { id_conversacion: idCon, contenido: `Orden ${n}` });
        await new Promise((r) => setTimeout(r, 200));
        sVet.off('nuevo_mensaje', alRecibir);
        expect(recibidos).toEqual(['Orden 1', 'Orden 2', 'Orden 3', 'Orden 4']);
    });
});

describe('Mensajes que llegan mientras el destinatario no está conectado', () => {
    beforeAll(async () => {
        await pool.query('DELETE FROM mensajes WHERE id_conversacion = $1', [idCon]);
        const sAna = await abrirSocket(tokens['ana@correo.com']);
        await enviar(sAna, { id_conversacion: idCon, contenido: 'Primero' });
        await enviar(sAna, { id_conversacion: idCon, contenido: 'Mientras no estabas' });
    });

    test('al volver, el veterinario ve el último mensaje y cuántos tiene sin leer', async () => {
        const c = await delLista(vet);
        expect(c.no_leidos).toBe(2);
        expect(c.ultimo_mensaje).toMatchObject({ contenido: 'Mientras no estabas' });
    });

    test('también están en el historial de la conversación', async () => {
        const r = await vet.get(`/api/conversaciones/${idCon}/mensajes`);
        expect(r.body.datos.map((m) => m.contenido)).toEqual(['Primero', 'Mientras no estabas']);
    });

    test('quien envió no tiene sus propios mensajes como no leídos', async () => {
        expect((await delLista(ana)).no_leidos).toBe(0);
    });
});

describe('Marcar como leídos', () => {
    test('al abrir la conversación los mensajes recibidos pasan a leídos', async () => {
        const r = await vet.put(`/api/conversaciones/${idCon}/leidos`);
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ actualizados: 2 });
        expect((await delLista(vet)).no_leidos).toBe(0);
    });

    test('no toca los mensajes que envió quien los marca', async () => {
        const sVet = await abrirSocket(tokens['vet@vetcontrol.com']);
        await enviar(sVet, { id_conversacion: idCon, contenido: 'Ya te respondo' });
        expect((await vet.put(`/api/conversaciones/${idCon}/leidos`)).body).toEqual({ actualizados: 0 });
        expect((await delLista(ana)).no_leidos).toBe(1);   // Ana todavía no lo abre
        expect((await ana.put(`/api/conversaciones/${idCon}/leidos`)).body).toEqual({ actualizados: 1 });
        expect((await delLista(ana)).no_leidos).toBe(0);
    });

    test('repetirlo no cambia nada', async () => {
        expect((await ana.put(`/api/conversaciones/${idCon}/leidos`)).body).toEqual({ actualizados: 0 });
    });

    test('solo los participantes pueden marcar: otro propietario y otro veterinario reciben 403', async () => {
        expect((await carlos.put(`/api/conversaciones/${idCon}/leidos`)).status).toBe(403);
        expect((await vet2.put(`/api/conversaciones/${idCon}/leidos`)).status).toBe(403);
    });

    test('una conversación inexistente responde 404 y sin sesión 401', async () => {
        expect((await ana.put('/api/conversaciones/9999/leidos')).status).toBe(404);
        expect((await request(app).put(`/api/conversaciones/${idCon}/leidos`)).status).toBe(401);
    });

    test('el contador de cada conversación es independiente', async () => {
        const otra = (await ana.post('/api/conversaciones', { id_veterinario: 2, id_mascota: 2 })).body.id_conversacion;
        const sVet2 = await abrirSocket(tokens['vet2@vetcontrol.com']);
        await enviar(sVet2, { id_conversacion: otra, contenido: 'Hola desde Andrés' });
        expect((await delLista(ana, otra)).no_leidos).toBe(1);
        expect((await delLista(ana, idCon)).no_leidos).toBe(0);
    });
});

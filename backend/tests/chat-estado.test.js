// Ep8-Hu4: estado de atención del veterinario (en línea, horario de atención y avisos)
const http = require('http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const { app, pool, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { iniciarChat } = require('../sockets/chat');
const {
    estadoHorario, momentoEnZona, textoProximaAtencion, avisoFueraDeHorario,
    marcarConectado, marcarDesconectado, estaEnLinea,
} = require('../utils/atencion');

// ------------------------------------------------------------------
//  Horario de atención (sin base de datos): las fechas están en UTC y Colombia es UTC-5
// ------------------------------------------------------------------
const lunesAViernes = [1, 2, 3, 4, 5].flatMap((d) => [
    { dia_semana: d, hora_inicio: '07:00:00', hora_fin: '12:00:00' },
    { dia_semana: d, hora_inicio: '14:00:00', hora_fin: '18:00:00' },
]);
// 16 de noviembre de 2026 = lunes
const lunes = (hhmm) => new Date(`2026-11-16T${hhmm}:00-05:00`);

describe('estadoHorario', () => {
    test('dentro de una franja el veterinario está en horario', () => {
        expect(estadoHorario(lunesAViernes, lunes('08:00'))).toEqual({ en_horario: true, proxima_atencion: null });
        expect(estadoHorario(lunesAViernes, lunes('16:30')).en_horario).toBe(true);
    });

    test('la hora de inicio cuenta y la de fin no', () => {
        expect(estadoHorario(lunesAViernes, lunes('07:00')).en_horario).toBe(true);
        expect(estadoHorario(lunesAViernes, lunes('11:59')).en_horario).toBe(true);
        expect(estadoHorario(lunesAViernes, lunes('12:00')).en_horario).toBe(false);
        expect(estadoHorario(lunesAViernes, lunes('06:59')).en_horario).toBe(false);
    });

    test('en el descanso del almuerzo vuelve a atender ese mismo día', () => {
        expect(estadoHorario(lunesAViernes, lunes('12:30'))).toEqual({
            en_horario: false, proxima_atencion: { dia_semana: 1, hora_inicio: '14:00', hoy: true },
        });
    });

    test('al terminar la jornada vuelve a atender el siguiente día con horario', () => {
        expect(estadoHorario(lunesAViernes, lunes('18:00')).proxima_atencion)
            .toEqual({ dia_semana: 2, hora_inicio: '07:00', hoy: false });
        // viernes por la noche -> lunes
        expect(estadoHorario(lunesAViernes, new Date('2026-11-20T19:00:00-05:00')).proxima_atencion)
            .toEqual({ dia_semana: 1, hora_inicio: '07:00', hoy: false });
        // sábado y domingo -> lunes
        expect(estadoHorario(lunesAViernes, new Date('2026-11-21T10:00:00-05:00')).proxima_atencion.dia_semana).toBe(1);
        expect(estadoHorario(lunesAViernes, new Date('2026-11-22T10:00:00-05:00')).proxima_atencion.dia_semana).toBe(1);
    });

    test('usa la hora de Colombia, no la del servidor', () => {
        // Lunes 02:00 UTC = domingo 9:00 p. m. en Colombia
        const r = estadoHorario(lunesAViernes, new Date('2026-11-16T02:00:00Z'));
        expect(momentoEnZona(new Date('2026-11-16T02:00:00Z'))).toEqual({ dia: 7, minutos: 21 * 60 });
        expect(r.en_horario).toBe(false);
        // Lunes 13:00 UTC = lunes 8:00 a. m. en Colombia
        expect(estadoHorario(lunesAViernes, new Date('2026-11-16T13:00:00Z')).en_horario).toBe(true);
    });

    test('con un solo día de atención, la próxima vez puede ser dentro de una semana', () => {
        const soloLunes = [{ dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '10:00:00' }];
        expect(estadoHorario(soloLunes, lunes('20:00')).proxima_atencion)
            .toEqual({ dia_semana: 1, hora_inicio: '08:00', hoy: false });
    });

    test('sin horario registrado no se sabe si está en horario (null)', () => {
        expect(estadoHorario([], lunes('08:00'))).toEqual({ en_horario: null, proxima_atencion: null });
    });
});

describe('textos del aviso', () => {
    test('describe cuándo vuelve a atender', () => {
        expect(textoProximaAtencion({ dia_semana: 1, hora_inicio: '14:00', hoy: true })).toBe('hoy a las 2:00 p. m.');
        expect(textoProximaAtencion({ dia_semana: 3, hora_inicio: '07:30', hoy: false })).toBe('el miércoles a las 7:30 a. m.');
        expect(textoProximaAtencion({ dia_semana: 2, hora_inicio: '12:00', hoy: false })).toBe('el martes a las 12:00 p. m.');
        expect(textoProximaAtencion(null)).toBeNull();
    });

    test('solo hay aviso cuando está claramente fuera de horario', () => {
        const fuera = { en_horario: false, proxima_atencion: { dia_semana: 1, hora_inicio: '07:00', hoy: false } };
        expect(avisoFueraDeHorario(fuera)).toMatch(/fuera de su horario de atención.*quedó guardado.*\(el lunes a las 7:00 a\. m\.\)\.$/);
        expect(avisoFueraDeHorario({ en_horario: true, proxima_atencion: null })).toBeNull();
        expect(avisoFueraDeHorario({ en_horario: null, proxima_atencion: null })).toBeNull();
    });
});

describe('presencia', () => {
    test('está en línea mientras tenga al menos una conexión abierta', () => {
        expect(estaEnLinea(77)).toBe(false);
        expect(marcarConectado(77, 'a')).toBe(true); // primera conexión
        expect(marcarConectado(77, 'b')).toBe(false); // segunda pestaña
        expect(estaEnLinea(77)).toBe(true);
        expect(marcarDesconectado(77, 'a')).toBe(false); // aún queda una
        expect(estaEnLinea(77)).toBe(true);
        expect(marcarDesconectado(77, 'b')).toBe(true); // se fue la última
        expect(estaEnLinea(77)).toBe(false);
        expect(marcarDesconectado(77, 'b')).toBe(false);
    });
});

// ------------------------------------------------------------------
//  Con el servidor y sockets reales
// ------------------------------------------------------------------
let servidor, url, io;
const tokens = {};
let vet, admin, ana, carlos;
const sockets = [];

/** Abre un socket que guarda todos los eventos que recibe (desde el primer instante). */
function abrirSocket(correo) {
    return new Promise((resolve, reject) => {
        const s = conectar(url, { auth: { token: tokens[correo] }, reconnection: false, forceNew: true });
        s.recibidos = [];
        s.onAny((nombre, datos) => s.recibidos.push({ nombre, datos }));
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });
}

const esperar = async (condicion, ms = 2000) => {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
        const valor = condicion();
        if (valor) return valor;
        await new Promise((r) => setTimeout(r, 20));
    }
    return null;
};
const evento = (socket, nombre, filtro = () => true) =>
    esperar(() => socket.recibidos.find((e) => e.nombre === nombre && filtro(e.datos)));
const cantidad = (socket, nombre) => socket.recibidos.filter((e) => e.nombre === nombre).length;
const pausa = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const enviar = (socket, datos) => socket.timeout(2000).emitWithAck('enviar_mensaje', datos);
const estadoDe = async (cliente, idVeterinario) =>
    (await cliente.get('/api/conversaciones')).body.find((c) => c.id_veterinario === idVeterinario)?.estado_atencion;

/** Deja al veterinario 1 con el horario indicado. */
async function fijarHorario(idVeterinario, filas) {
    await pool.query('DELETE FROM horarios_veterinario WHERE id_veterinario = $1', [idVeterinario]);
    for (const [dia, ini, fin] of filas) {
        await pool.query(
            'INSERT INTO horarios_veterinario (id_veterinario, dia_semana, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)',
            [idVeterinario, dia, ini, fin]
        );
    }
}
/** Un horario que cubre el momento actual (hora de Colombia) / uno que no lo cubre. */
const horarioQueIncluyeAhora = () => [[momentoEnZona().dia, '00:00', '23:59']];
const horarioDeOtroDia = () => [[(momentoEnZona().dia % 7) + 1, '08:00', '17:00']];

let idConVet1, idConVet2;

beforeAll(async () => {
    await reiniciarBase();
    for (const correo of ['vet@vetcontrol.com', 'vet2@vetcontrol.com', 'admin@vetcontrol.com', 'ana@correo.com', 'carlos@correo.com']) {
        tokens[correo] = await iniciarSesion(correo);
    }
    vet = api(tokens['vet@vetcontrol.com']); // id_veterinario 1
    admin = api(tokens['admin@vetcontrol.com']);
    ana = api(tokens['ana@correo.com']);
    carlos = api(tokens['carlos@correo.com']);

    servidor = http.createServer(app);
    io = new Server(servidor);
    app.set('io', io);
    iniciarChat(io);
    await new Promise((r) => servidor.listen(0, r));
    url = `http://localhost:${servidor.address().port}`;

    idConVet1 = (await ana.post('/api/conversaciones', { id_veterinario: 1 })).body.id_conversacion;
});

afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    app.set('io', undefined);
    await new Promise((r) => servidor.close(r));
    await pool.end();
});

describe('Veterinario en línea / fuera de línea', () => {
    test('sin sesión del veterinario en el chat aparece fuera de línea', async () => {
        const estado = await estadoDe(ana, 1);
        expect(estado).toMatchObject({ id_veterinario: 1, en_linea: false });
        expect(estado.horario.length).toBeGreaterThan(0);
    });

    test('al conectarse el propietario recibe el estado actual de sus veterinarios', async () => {
        const sAna = await abrirSocket('ana@correo.com');
        const snapshot = await evento(sAna, 'estados_veterinarios');
        expect(snapshot.datos).toEqual([{ id_veterinario: 1, en_linea: false }]);
    });

    test('cuando el veterinario abre el chat el propietario lo ve en línea al instante, y al salir, fuera de línea', async () => {
        const sAna = await abrirSocket('ana@correo.com');
        await evento(sAna, 'estados_veterinarios');

        const sVet = await abrirSocket('vet@vetcontrol.com');
        expect(await evento(sAna, 'estado_veterinario', (d) => d.en_linea === true)).toBeTruthy();
        expect((await estadoDe(ana, 1)).en_linea).toBe(true);

        sVet.disconnect();
        expect(await evento(sAna, 'estado_veterinario', (d) => d.en_linea === false)).toBeTruthy();
        expect((await estadoDe(ana, 1)).en_linea).toBe(false);
    });

    test('con varias pestañas abiertas sigue en línea hasta cerrar la última', async () => {
        const sAna = await abrirSocket('ana@correo.com');
        await evento(sAna, 'estados_veterinarios');
        const pestana1 = await abrirSocket('vet@vetcontrol.com');
        const pestana2 = await abrirSocket('vet@vetcontrol.com');
        await evento(sAna, 'estado_veterinario', (d) => d.en_linea === true);
        expect(cantidad(sAna, 'estado_veterinario')).toBe(1); // la segunda pestaña no repite el aviso

        pestana1.disconnect();
        await pausa();
        expect(cantidad(sAna, 'estado_veterinario')).toBe(1);
        expect((await estadoDe(ana, 1)).en_linea).toBe(true);

        pestana2.disconnect();
        expect(await evento(sAna, 'estado_veterinario', (d) => d.en_linea === false)).toBeTruthy();
    });

    test('el propietario que no conversa con ese veterinario no recibe su estado', async () => {
        const sCarlos = await abrirSocket('carlos@correo.com');
        await evento(sCarlos, 'estados_veterinarios');
        const sVet = await abrirSocket('vet@vetcontrol.com');
        await pausa(250);
        expect(cantidad(sCarlos, 'estado_veterinario')).toBe(0);
        sVet.disconnect();
        await pausa();
    });

    test('el veterinario no recibe el estado de atención en sus conversaciones (solo el propietario lo ve)', async () => {
        const conv = (await vet.get('/api/conversaciones')).body.find((c) => c.id_conversacion === idConVet1);
        expect(conv.estado_atencion).toBeUndefined();
    });

    test('la lista de veterinarios para iniciar una conversación trae su estado', async () => {
        const lista = (await ana.get('/api/conversaciones/veterinarios')).body;
        expect(lista.find((v) => v.id_veterinario === 1).estado_atencion).toMatchObject({ en_linea: false });
        expect(lista.find((v) => v.id_veterinario === 2).estado_atencion).toHaveProperty('en_horario');
    });
});

describe('Seguir a un veterinario con una conversación nueva', () => {
    test('el propietario empieza a recibir su estado sin volver a conectarse', async () => {
        const sAna = await abrirSocket('ana@correo.com');
        await evento(sAna, 'estados_veterinarios');
        idConVet2 = (await ana.post('/api/conversaciones', { id_veterinario: 2 })).body.id_conversacion;

        const sVet2 = await abrirSocket('vet2@vetcontrol.com');
        await pausa(250);
        expect(cantidad(sAna, 'estado_veterinario')).toBe(0); // todavía no lo sigue

        const ack = await sAna.timeout(2000).emitWithAck('seguir_veterinario', { id_veterinario: 2 });
        expect(ack.estado).toEqual({ id_veterinario: 2, en_linea: true });

        sVet2.disconnect();
        expect(await evento(sAna, 'estado_veterinario', (d) => d.id_veterinario === 2 && d.en_linea === false)).toBeTruthy();
    });

    test('solo puede seguir a veterinarios con los que ya conversa y solo el propietario', async () => {
        const sCarlos = await abrirSocket('carlos@correo.com');
        const sVet = await abrirSocket('vet@vetcontrol.com');
        const sAna = await abrirSocket('ana@correo.com');
        const pedir = (s, datos) => s.timeout(2000).emitWithAck('seguir_veterinario', datos);
        expect(await pedir(sCarlos, { id_veterinario: 1 })).toMatchObject({ estado: 403 });
        expect(await pedir(sVet, { id_veterinario: 1 })).toMatchObject({ estado: 403 });
        expect(await pedir(sAna, { id_veterinario: 'x' })).toMatchObject({ estado: 400 });
        expect(await pedir(sAna, undefined)).toMatchObject({ estado: 400 });
        expect(await pedir(sAna, { id_veterinario: 1 })).toHaveProperty('estado.en_linea');
        sVet.disconnect();
    });
});

describe('Horario de atención y aviso fuera de horario', () => {
    let sAna, sVet;
    beforeAll(async () => {
        sAna = await abrirSocket('ana@correo.com');
        sVet = await abrirSocket('vet@vetcontrol.com');
    });

    test('el estado indica si el veterinario está en horario de atención ahora', async () => {
        await fijarHorario(1, horarioQueIncluyeAhora());
        expect(await estadoDe(ana, 1)).toMatchObject({ en_horario: true, proxima_atencion: null });

        await fijarHorario(1, horarioDeOtroDia());
        const fuera = await estadoDe(ana, 1);
        expect(fuera.en_horario).toBe(false);
        expect(fuera.proxima_atencion).toMatchObject({ dia_semana: horarioDeOtroDia()[0][0], hora_inicio: '08:00', hoy: false });
        expect(fuera.horario).toEqual([{ dia_semana: horarioDeOtroDia()[0][0], hora_inicio: '08:00', hora_fin: '17:00' }]);
    });

    test('dentro del horario el mensaje se envía sin aviso', async () => {
        await fijarHorario(1, horarioQueIncluyeAhora());
        const ack = await enviar(sAna, { id_conversacion: idConVet1, contenido: 'Hola, ¿están atendiendo?' });
        expect(ack.mensaje).toBeTruthy();
        expect(ack.aviso).toBeUndefined();
    });

    test('fuera del horario el mensaje se guarda igual y el propietario recibe el aviso', async () => {
        await fijarHorario(1, horarioDeOtroDia());
        const ack = await enviar(sAna, { id_conversacion: idConVet1, contenido: 'Mensaje de la noche' });
        expect(ack.mensaje).toMatchObject({ contenido: 'Mensaje de la noche' });
        expect(ack.aviso).toMatch(/fuera de su horario de atención/);
        expect(ack.aviso).toMatch(/a las 8:00 a\. m\./);
        const { rows } = await pool.query('SELECT 1 FROM mensajes WHERE id_mensaje = $1', [ack.mensaje.id_mensaje]);
        expect(rows).toHaveLength(1);
    });

    test('el veterinario no recibe aviso al responder, aunque esté fuera de su horario', async () => {
        await fijarHorario(1, horarioDeOtroDia());
        const ack = await enviar(sVet, { id_conversacion: idConVet1, contenido: 'Le respondo ahora' });
        expect(ack.mensaje).toBeTruthy();
        expect(ack.aviso).toBeUndefined();
    });

    test('si el veterinario no tiene horario registrado no se muestra ningún aviso', async () => {
        await fijarHorario(1, []);
        expect(await estadoDe(ana, 1)).toMatchObject({ en_horario: null, proxima_atencion: null, horario: [] });
        const ack = await enviar(sAna, { id_conversacion: idConVet1, contenido: 'Sin horario definido' });
        expect(ack.mensaje).toBeTruthy();
        expect(ack.aviso).toBeUndefined();
    });

    test('cuando el administrador cambia el horario el propietario se entera al instante', async () => {
        await fijarHorario(1, horarioDeOtroDia());
        const antes = cantidad(sAna, 'horario_actualizado');
        const r = await admin.post('/api/veterinarios/1/horarios', { dia_semana: momentoEnZona().dia, hora_inicio: '00:00', hora_fin: '23:59' });
        expect(r.status).toBe(201);
        await esperar(() => cantidad(sAna, 'horario_actualizado') > antes);
        expect(sAna.recibidos.filter((e) => e.nombre === 'horario_actualizado').pop().datos).toEqual({ id_veterinario: 1 });
        expect(await estadoDe(ana, 1)).toMatchObject({ en_horario: true });

        // Editar y borrar el horario también avisan
        const idHorario = r.body.id_horario;
        const n1 = cantidad(sAna, 'horario_actualizado');
        expect((await admin.put(`/api/veterinarios/1/horarios/${idHorario}`, { hora_fin: '23:00' })).status).toBe(200);
        await esperar(() => cantidad(sAna, 'horario_actualizado') > n1);
        const n2 = cantidad(sAna, 'horario_actualizado');
        expect((await admin.delete(`/api/veterinarios/1/horarios/${idHorario}`)).status).toBe(204);
        await esperar(() => cantidad(sAna, 'horario_actualizado') > n2);
        expect(cantidad(sAna, 'horario_actualizado')).toBeGreaterThan(n2);
    });

    test('quien no conversa con ese veterinario no se entera de sus cambios de horario', async () => {
        const sCarlos = await abrirSocket('carlos@correo.com');
        await evento(sCarlos, 'estados_veterinarios');
        await admin.post('/api/veterinarios/1/horarios', { dia_semana: 7, hora_inicio: '09:00', hora_fin: '10:00' });
        await pausa(250);
        expect(cantidad(sCarlos, 'horario_actualizado')).toBe(0);
    });

    test('el administrador sigue sin poder usar el chat ni ver estados', async () => {
        expect((await admin.get('/api/conversaciones')).status).toBe(403);
        await expect(abrirSocket('admin@vetcontrol.com')).rejects.toThrow(/chat/i);
    });

    test('Carlos no ve el estado de conversaciones ajenas', async () => {
        expect((await carlos.get('/api/conversaciones')).body).toEqual([]);
    });
});

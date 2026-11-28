// Ep5-Hu5: registro del seguimiento de tratamientos por el propietario
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, admin, ana, carlos;
let idTratamiento; // tratamiento activo de Max (propietaria: Ana)

beforeAll(async () => {
    await reiniciarBase();
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
    idTratamiento = 1; // Meloxicam, activo (seed)
});
afterAll(() => pool.end());

const ruta = (id = idTratamiento) => `/api/tratamientos/${id}/evoluciones`;
const notas = async (id = idTratamiento) => (await pool.query('SELECT * FROM evoluciones_tratamiento WHERE id_tratamiento = $1', [id])).rows;

describe('Criterio 1: agregar una nota con descripción; fecha y hora automáticas', () => {
    test('el propietario agrega una nota solo con la descripción', async () => {
        const r = await ana.post(ruta(), { descripcion: 'Hoy comió mejor y corrió en el parque' });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({
            id_tratamiento: idTratamiento,
            descripcion: 'Hoy comió mejor y corrió en el parque',
            estado_general: null,
            autor_nombre: 'Ana',
        });
        expect(r.body.id_evolucion).toBeDefined();
    });

    test('la fecha y la hora las pone el servidor, aunque el cliente intente enviarlas', async () => {
        const antes = Date.now();
        const r = await ana.post(ruta(), { descripcion: 'Con fecha falsa', fecha: '2001-01-01T00:00:00Z', fecha_registro: '2001-01-01T00:00:00Z' });
        expect(r.status).toBe(201);
        const fecha = new Date(r.body.fecha).getTime();
        expect(fecha).toBeGreaterThanOrEqual(antes - 5000);
        expect(fecha).toBeLessThanOrEqual(Date.now() + 5000);
    });

    test('el calificativo del estado general sigue siendo opcional pero se valida si se envía', async () => {
        expect((await ana.post(ruta(), { descripcion: 'Con estado', estado_general: 4 })).status).toBe(201);
        expect((await ana.post(ruta(), { descripcion: 'Estado inválido', estado_general: 9 })).status).toBe(400);
    });
});

describe('Criterio 2: solo notas en tratamientos activos de mis propias mascotas', () => {
    test('otro propietario recibe 403', async () => {
        const antes = (await notas()).length;
        expect((await carlos.post(ruta(), { descripcion: 'No es mi mascota' })).status).toBe(403);
        expect((await notas()).length).toBe(antes);
    });

    test('el veterinario y el administrador no pueden agregar notas (son del propietario)', async () => {
        expect((await vet.post(ruta(), { descripcion: 'x' })).status).toBe(403);
        expect((await admin.post(ruta(), { descripcion: 'x' })).status).toBe(403);
    });

    test('un tratamiento inexistente responde 404', async () => {
        expect((await ana.post(ruta(9999), { descripcion: 'x' })).status).toBe(404);
    });

    test('un tratamiento finalizado o suspendido responde 409 y no guarda la nota', async () => {
        for (const estado of ['finalizado', 'suspendido']) {
            const t = await vet.post('/api/consultas/1/tratamientos', { medicamento: `Prueba ${estado}`, dosis: '1 mg', frecuencia: 'cada 24 horas' });
            expect(t.status).toBe(201);
            expect((await vet.put(`/api/tratamientos/${t.body.id_tratamiento}`, { estado })).status).toBe(200);
            const r = await ana.post(ruta(t.body.id_tratamiento), { descripcion: `Nota en tratamiento ${estado}` });
            expect(r.status).toBe(409);
            expect(await notas(t.body.id_tratamiento)).toHaveLength(0);
        }
    });
});

describe('Criterio 3: la descripción es obligatoria', () => {
    test.each([
        ['sin descripción', {}],
        ['vacía', { descripcion: '' }],
        ['solo espacios', { descripcion: '     ' }],
        ['no es texto', { descripcion: 123 }],
    ])('rechaza la nota %s con 400', async (_n, body) => {
        const antes = (await notas()).length;
        const r = await ana.post(ruta(), body);
        expect(r.status).toBe(400);
        expect((await notas()).length).toBe(antes);
    });

    test('rechaza descripciones de más de 2000 caracteres', async () => {
        expect((await ana.post(ruta(), { descripcion: 'a'.repeat(2001) })).status).toBe(400);
    });
});

describe('Criterio 4: el veterinario ve las notas en orden cronológico', () => {
    test('las notas salen de la más antigua a la más reciente, con su autor', async () => {
        await pool.query('TRUNCATE evoluciones_tratamiento');
        const hoy = Date.now();
        // Se insertan desordenadas para comprobar que el orden lo da la fecha y no el id
        for (const [texto, dias] of [['Segunda', 2], ['Tercera', 1], ['Primera', 3]]) {
            await pool.query(
                `INSERT INTO evoluciones_tratamiento (id_tratamiento, id_usuario, fecha, descripcion)
                 SELECT 1, id_usuario, $1, $2 FROM usuarios WHERE correo = 'ana@correo.com'`,
                [new Date(hoy - dias * 86400000), texto]
            );
        }
        const r = await vet.get(ruta());
        expect(r.status).toBe(200);
        expect(r.body.map((n) => n.descripcion)).toEqual(['Primera', 'Segunda', 'Tercera']);
        expect(r.body[0]).toMatchObject({ autor_nombre: 'Ana', autor_apellido: expect.any(String) });
    });

    test('el propietario de la mascota también las ve, otro propietario no', async () => {
        expect((await ana.get(ruta())).status).toBe(200);
        expect((await carlos.get(ruta())).status).toBe(403);
    });

    test('las notas de un tratamiento ya finalizado se siguen consultando', async () => {
        await ana.post(ruta(), { descripcion: 'Antes de finalizar' });
        await vet.put(`/api/tratamientos/${idTratamiento}`, { estado: 'finalizado' });
        const r = await vet.get(ruta());
        expect(r.status).toBe(200);
        expect(r.body.map((n) => n.descripcion)).toContain('Antes de finalizar');
        await vet.put(`/api/tratamientos/${idTratamiento}`, { estado: 'activo' });
    });

    test('la hoja de consulta incluye el tratamiento para mostrar sus notas', async () => {
        const r = await vet.get('/api/consultas/1');
        expect(r.status).toBe(200);
        expect(r.body.tratamientos.map((t) => t.id_tratamiento)).toContain(idTratamiento);
    });
});

describe('Criterio 5: guardan quién y cuándo, y no se pueden eliminar', () => {
    test('queda guardado el usuario autenticado como autor', async () => {
        const r = await ana.post(ruta(), { descripcion: 'Nota con autor' });
        const { rows } = await pool.query(
            'SELECT u.correo FROM evoluciones_tratamiento e JOIN usuarios u USING (id_usuario) WHERE e.id_evolucion = $1',
            [r.body.id_evolucion]
        );
        expect(rows[0].correo).toBe('ana@correo.com');
    });

    test('la API no ofrece rutas para editar ni eliminar notas', async () => {
        const { body } = await ana.post(ruta(), { descripcion: 'Intocable' });
        for (const url of [`${ruta()}/${body.id_evolucion}`, `/api/evoluciones/${body.id_evolucion}`]) {
            for (const metodo of ['put', 'patch', 'delete']) {
                expect([404, 405]).toContain((await ana[metodo](url, { descripcion: 'cambiada' })).status);
            }
        }
        expect((await notas()).find((n) => n.id_evolucion === body.id_evolucion).descripcion).toBe('Intocable');
    });

    test('la base de datos impide eliminarlas o modificarlas', async () => {
        const { body } = await ana.post(ruta(), { descripcion: 'Protegida' });
        await expect(pool.query('DELETE FROM evoluciones_tratamiento WHERE id_evolucion = $1', [body.id_evolucion]))
            .rejects.toMatchObject({ code: '23001' });
        await expect(pool.query("UPDATE evoluciones_tratamiento SET descripcion = 'x' WHERE id_evolucion = $1", [body.id_evolucion]))
            .rejects.toMatchObject({ code: '23001' });
        expect((await notas()).some((n) => n.id_evolucion === body.id_evolucion)).toBe(true);
    });

    test('no se puede borrar un tratamiento que ya tiene notas', async () => {
        await expect(pool.query('DELETE FROM tratamientos WHERE id_tratamiento = $1', [idTratamiento]))
            .rejects.toThrow(/evoluciones_tratamiento_id_tratamiento_fkey/);
    });
});

describe('Sesión', () => {
    test('sin sesión no se puede ver ni agregar', async () => {
        const request = require('supertest');
        const { app } = require('./helpers');
        expect((await request(app).get(ruta())).status).toBe(401);
        expect((await request(app).post(ruta()).send({ descripcion: 'x' })).status).toBe(401);
    });
});

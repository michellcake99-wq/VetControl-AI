// Ep4-Hu1: registro de vacunas con catálogo, corrección y carné de vacunación
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, ana, carlos, admin;
let catalogo;
const idCatalogo = (nombre) => catalogo.find((c) => c.nombre === nombre).id_catalogo;

beforeAll(async () => {
    await reiniciarBase();
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
    catalogo = (await vet.get('/api/vacunas/catalogo')).body;
});
afterAll(() => pool.end());

describe('Catálogo de vacunas', () => {
    test('requiere sesión', async () => {
        expect((await request(app).get('/api/vacunas/catalogo')).status).toBe(401);
    });

    test('lista las vacunas disponibles', async () => {
        expect(catalogo.length).toBeGreaterThanOrEqual(8);
        expect(catalogo[0]).toHaveProperty('dias_refuerzo');
    });

    test('filtra por especie (incluye las que aplican a todas)', async () => {
        const r = await ana.get('/api/vacunas/catalogo?especie=felino');
        const nombres = r.body.map((c) => c.nombre);
        expect(nombres).toEqual(expect.arrayContaining(['Triple felina', 'Rabia']));
        expect(nombres).not.toContain('Pentavalente canina');
    });
});

describe('Registro de vacunas (veterinario)', () => {
    test('registra una vacuna elegida del catálogo con todos sus datos', async () => {
        // Historia 2 = Luna (felino) de Ana
        const r = await vet.post('/api/historias/2/vacunas', {
            id_catalogo: idCatalogo('Leucemia felina'),
            laboratorio: 'Zoetis',
            lote: 'FL-001',
            fecha_aplicacion: '2026-11-10',
            proxima_dosis: '2027-11-10',
            observaciones: 'Sin reacciones',
        });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({
            nombre: 'Leucemia felina', lote: 'FL-001', id_veterinario: 1, nombre_veterinario: 'Laura Quintero',
        });
    });

    test('no permite una vacuna del catálogo de otra especie', async () => {
        const r = await vet.post('/api/historias/2/vacunas', {
            id_catalogo: idCatalogo('Pentavalente canina'), fecha_aplicacion: '2026-11-10',
        });
        expect(r.status).toBe(400);
        expect(r.body.detalles[0].campo).toBe('id_catalogo');
    });

    test('valida que la próxima dosis sea posterior a la aplicación', async () => {
        const r = await vet.post('/api/historias/2/vacunas', {
            id_catalogo: idCatalogo('Rabia'), fecha_aplicacion: '2026-11-10', proxima_dosis: '2026-11-10',
        });
        expect(r.status).toBe(400);
        expect(r.body.detalles[0].campo).toBe('proxima_dosis');
    });

    test('exige elegir una vacuna y no acepta fechas de aplicación futuras', async () => {
        expect((await vet.post('/api/historias/2/vacunas', { fecha_aplicacion: '2026-11-10' })).status).toBe(400);
        const futura = await vet.post('/api/historias/2/vacunas', { id_catalogo: idCatalogo('Rabia'), fecha_aplicacion: '2999-01-01' });
        expect(futura.status).toBe(400);
    });

    test('el propietario y el administrador no pueden registrar vacunas', async () => {
        const cuerpo = { id_catalogo: idCatalogo('Rabia'), fecha_aplicacion: '2026-11-10' };
        expect((await ana.post('/api/historias/2/vacunas', cuerpo)).status).toBe(403);
        expect((await admin.post('/api/historias/2/vacunas', cuerpo)).status).toBe(403);
    });
});

describe('Carné de vacunación', () => {
    test('se muestra en orden cronológico', async () => {
        const r = await ana.get('/api/historias/2/vacunas');
        expect(r.status).toBe(200);
        const fechas = r.body.map((v) => v.fecha_aplicacion);
        expect(fechas).toEqual([...fechas].sort());
        expect(r.body.map((v) => v.nombre)).toEqual(['Triple felina', 'Leucemia felina']);
    });

    test('el propietario no ve el carné de mascotas ajenas', async () => {
        // Historia 3 = Rocky de Carlos
        expect((await ana.get('/api/historias/3/vacunas')).status).toBe(403);
        expect((await carlos.get('/api/historias/3/vacunas')).status).toBe(200);
    });
});

describe('Corrección de registros (veterinario)', () => {
    let idVacuna;
    beforeAll(async () => {
        idVacuna = (await ana.get('/api/historias/2/vacunas')).body.find((v) => v.nombre === 'Leucemia felina').id_vacuna;
    });

    test('el veterinario corrige el lote y la próxima dosis', async () => {
        const r = await vet.put(`/api/vacunas/${idVacuna}`, { lote: 'FL-002', proxima_dosis: '2027-12-01' });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ lote: 'FL-002', proxima_dosis: '2027-12-01' });
    });

    test('valida las fechas combinando lo nuevo con lo guardado', async () => {
        // Solo llega la próxima dosis, anterior a la aplicación guardada (2026-11-10)
        const r = await vet.put(`/api/vacunas/${idVacuna}`, { proxima_dosis: '2026-01-01' });
        expect(r.status).toBe(400);
        expect(r.body.detalles[0].campo).toBe('proxima_dosis');
    });

    test('al cambiar la vacuna por otra del catálogo se actualiza el nombre', async () => {
        const r = await vet.put(`/api/vacunas/${idVacuna}`, { id_catalogo: idCatalogo('Rabia') });
        expect(r.status).toBe(200);
        expect(r.body.nombre).toBe('Rabia');
    });

    test('el propietario no puede corregir registros', async () => {
        expect((await ana.put(`/api/vacunas/${idVacuna}`, { lote: 'X' })).status).toBe(403);
    });

    test('responde 404 si la vacuna no existe', async () => {
        expect((await vet.put('/api/vacunas/9999', { lote: 'X' })).status).toBe(404);
    });
});

// Ep4-Hu5: gestión de veterinarios (administrador) y Ep7-Hu1: control de acceso por rol
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let admin, vet, ana;
beforeAll(async () => {
    await reiniciarBase();
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
    ana = api(await iniciarSesion('ana@correo.com'));
});
afterAll(() => pool.end());

const nuevoVeterinario = {
    nombre: 'Sofía',
    apellido: 'Díaz',
    correo: 'sofia@vetcontrol.com',
    contrasena: 'Temporal123',
    tarjeta_profesional: 'MV-99999',
    especialidad: 'Dermatología',
};

describe('Ep7-Hu1: acceso según rol a /api/veterinarios', () => {
    test('sin token responde 401', async () => {
        expect((await request(app).get('/api/veterinarios')).status).toBe(401);
    });

    test('propietario y veterinario reciben 403', async () => {
        expect((await ana.get('/api/veterinarios')).status).toBe(403);
        expect((await vet.get('/api/veterinarios')).status).toBe(403);
        expect((await vet.post('/api/veterinarios', nuevoVeterinario)).status).toBe(403);
    });

    test('el propietario no puede listar todos los propietarios', async () => {
        expect((await ana.get('/api/propietarios')).status).toBe(403);
        expect((await vet.get('/api/propietarios')).status).toBe(200);
    });
});

describe('Ep4-Hu5: gestión de veterinarios', () => {
    let idNuevo;

    test('el administrador lista los veterinarios', async () => {
        const r = await admin.get('/api/veterinarios');
        expect(r.status).toBe(200);
        expect(r.body.datos.length).toBeGreaterThanOrEqual(2);
        expect(r.body.datos[0]).not.toHaveProperty('contrasena_hash');
    });

    test('crea un veterinario con su cuenta y perfil', async () => {
        const r = await admin.post('/api/veterinarios', nuevoVeterinario);
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ nombre: 'Sofía', tarjeta_profesional: 'MV-99999', activo: true });
        idNuevo = r.body.id_veterinario;
    });

    test('no permite repetir la tarjeta profesional ni el correo (409)', async () => {
        const otraTarjeta = { ...nuevoVeterinario, correo: 'otro@vetcontrol.com' };
        expect((await admin.post('/api/veterinarios', otraTarjeta)).status).toBe(409);
        const otroCorreo = { ...nuevoVeterinario, tarjeta_profesional: 'MV-88888' };
        expect((await admin.post('/api/veterinarios', otroCorreo)).status).toBe(409);
    });

    test('valida los datos obligatorios (400)', async () => {
        const r = await admin.post('/api/veterinarios', { ...nuevoVeterinario, contrasena: '123' });
        expect(r.status).toBe(400);
    });

    test('edita los datos del veterinario', async () => {
        const r = await admin.put(`/api/veterinarios/${idNuevo}`, { especialidad: 'Oftalmología', nombre: 'Sofi' });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ especialidad: 'Oftalmología', nombre: 'Sofi' });
    });

    test('no permite cambiar el correo desde la edición', async () => {
        const r = await admin.put(`/api/veterinarios/${idNuevo}`, { correo: 'nuevo@vetcontrol.com' });
        expect(r.status).toBe(400);
    });

    test('al desactivarlo ya no puede iniciar sesión', async () => {
        expect(await iniciarSesion('sofia@vetcontrol.com', 'Temporal123')).toBeTruthy();
        expect((await admin.delete(`/api/veterinarios/${idNuevo}`)).status).toBe(204);
        expect(await iniciarSesion('sofia@vetcontrol.com', 'Temporal123')).toBeUndefined();
        // Sigue existiendo (su historial se conserva)
        expect((await admin.get(`/api/veterinarios/${idNuevo}`)).body.activo).toBe(false);
    });
});

describe('Ep4-Hu5: horarios de atención', () => {
    let idHorario;

    test('registra un horario (incluido el domingo = 7)', async () => {
        const r = await admin.post('/api/veterinarios/1/horarios', {
            dia_semana: 7,
            hora_inicio: '09:00',
            hora_fin: '12:00',
        });
        expect(r.status).toBe(201);
        idHorario = r.body.id_horario;
    });

    test('rechaza días fuera de 1–7 y horas al revés (400)', async () => {
        const fueraDeRango = { dia_semana: 0, hora_inicio: '09:00', hora_fin: '12:00' };
        expect((await admin.post('/api/veterinarios/1/horarios', fueraDeRango)).status).toBe(400);
        const alReves = { dia_semana: 2, hora_inicio: '15:00', hora_fin: '10:00' };
        expect((await admin.post('/api/veterinarios/1/horarios', alReves)).status).toBe(400);
    });

    test('no deja modificar el horario desde otro veterinario (404)', async () => {
        expect((await admin.put(`/api/veterinarios/2/horarios/${idHorario}`, { hora_fin: '13:00' })).status).toBe(404);
        const r = await admin.put(`/api/veterinarios/1/horarios/${idHorario}`, { hora_fin: '13:00' });
        expect(r.status).toBe(200);
        expect(r.body.hora_fin.slice(0, 5)).toBe('13:00');
    });

    test('lista y elimina horarios', async () => {
        const lista = await admin.get('/api/veterinarios/1/horarios');
        expect(lista.body.some((h) => h.id_horario === idHorario)).toBe(true);
        expect((await admin.delete(`/api/veterinarios/1/horarios/${idHorario}`)).status).toBe(204);
    });
});

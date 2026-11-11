// Ep3-Hu4: API de propietarios y mascotas
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, admin, ana, carlos;
beforeAll(async () => {
    await reiniciarBase();
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
    ana = api(await iniciarSesion('ana@correo.com'));         // id_propietario 1 (Max, Luna)
    carlos = api(await iniciarSesion('carlos@correo.com'));   // id_propietario 2 (Rocky)
});
afterAll(() => pool.end());

describe('Seguridad (usa el verificarToken existente)', () => {
    test('sin token responde 401', async () => {
        expect((await request(app).get('/api/propietarios')).status).toBe(401);
    });
    test('token inválido responde 401', async () => {
        expect((await api('xxx').get('/api/mascotas')).status).toBe(401);
    });
});

describe('Propietarios', () => {
    test('el veterinario lista propietarios con búsqueda y paginación', async () => {
        const r = await vet.get('/api/propietarios?q=torres');
        expect(r.status).toBe(200);
        expect(r.body.meta).toMatchObject({ pagina: 1, total: 1 });
        expect(r.body.datos[0]).toMatchObject({ nombre: 'Ana', correo: 'ana@correo.com', total_mascotas: 2 });
    });

    test('el administrador también puede listar', async () => {
        expect((await admin.get('/api/propietarios')).status).toBe(200);
    });

    test('un propietario NO puede listar a todos', async () => {
        expect((await ana.get('/api/propietarios')).status).toBe(403);
    });

    test('el veterinario registra un propietario con su cuenta y este puede iniciar sesión', async () => {
        const r = await vet.post('/api/propietarios', {
            nombre: 'Sofía', apellido: 'Díaz', correo: 'Sofia@Correo.com', contrasena: 'Clave12345',
            numero_documento: '1091888888', telefono: '3201112244',
        });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ nombre: 'Sofía', correo: 'sofia@correo.com', tipo_documento: 'CC', activo: true });
        expect(await iniciarSesion('sofia@correo.com', 'Clave12345')).toEqual(expect.any(String));
    });

    test('valida campos obligatorios y formatos (400 con detalle por campo)', async () => {
        const r = await vet.post('/api/propietarios', { numero_documento: '1', nombre: '', telefono: 'abc', correo: 'malo' });
        expect(r.status).toBe(400);
        expect(r.body.detalles.map((d) => d.campo)).toEqual(
            expect.arrayContaining(['numero_documento', 'nombre', 'apellido', 'telefono', 'correo', 'contrasena'])
        );
    });

    test('documento o correo repetido responde 409', async () => {
        const base = { nombre: 'X', apellido: 'Y', contrasena: 'Clave12345', telefono: '3000000000' };
        expect((await vet.post('/api/propietarios', { ...base, correo: 'otro@x.com', numero_documento: '1091000001' })).status).toBe(409);
        expect((await vet.post('/api/propietarios', { ...base, correo: 'ana@correo.com', numero_documento: '5555555' })).status).toBe(409);
    });

    test('el propietario ve su perfil con sus mascotas', async () => {
        const r = await ana.get('/api/propietarios/me');
        expect(r.status).toBe(200);
        expect(r.body.mascotas.map((m) => m.nombre).sort()).toEqual(['Luna', 'Max']);
    });

    test('quien se registra por /api/auth/register ya tiene perfil y lo puede completar', async () => {
        await request(app).post('/api/auth/register').send({ nombre: 'Leo', apellido: 'Ruiz', correo: 'leo@correo.com', contrasena: 'Clave12345' });
        const leo = api(await iniciarSesion('leo@correo.com', 'Clave12345'));
        const perfil = await leo.get('/api/propietarios/me');
        expect(perfil.body).toMatchObject({ nombre: 'Leo', numero_documento: null });
        const r = await leo.put(`/api/propietarios/${perfil.body.id_propietario}`, { numero_documento: '1091777777', telefono: '3001112233' });
        expect(r.status).toBe(200);
        expect(r.body.numero_documento).toBe('1091777777');
    });

    test('un propietario no puede ver a otro propietario (403)', async () => {
        expect((await ana.get('/api/propietarios/2')).status).toBe(403);
    });

    test('el propietario actualiza su teléfono y nombre, pero no cambia su documento', async () => {
        const r = await ana.put('/api/propietarios/1', { telefono: '3009998877', nombre: 'Ana María' });
        expect(r.body).toMatchObject({ telefono: '3009998877', nombre: 'Ana María' });
        expect((await ana.put('/api/propietarios/1', { numero_documento: '123456' })).status).toBe(403);
    });

    test('propietario inexistente 404; id no numérico 400', async () => {
        expect((await vet.get('/api/propietarios/999')).status).toBe(404);
        expect((await vet.get('/api/propietarios/abc')).status).toBe(400);
    });
});

describe('Mascotas', () => {
    test('el veterinario registra una mascota y se crea su historia clínica', async () => {
        const r = await vet.post('/api/mascotas', {
            id_propietario: 2, nombre: 'Nala', especie: 'Felino', raza: 'Siamés', sexo: 'hembra',
            fecha_nacimiento: '2024-01-10', peso_kg: 3.5,
        });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ nombre: 'Nala', especie: 'felino', peso_kg: 3.5, fecha_nacimiento: '2024-01-10' });
        expect(r.body.historia.numero).toMatch(/^HC-\d{6}$/);
    });

    test('el propietario registra una mascota a su nombre aunque envíe otro id_propietario', async () => {
        const r = await ana.post('/api/mascotas', { id_propietario: 2, nombre: 'Coco', especie: 'canino' });
        expect(r.status).toBe(201);
        expect(r.body.id_propietario).toBe(1);
    });

    test('rechaza fecha de nacimiento futura y peso negativo', async () => {
        const r = await vet.post('/api/mascotas', {
            id_propietario: 1, nombre: 'X', especie: 'canino', fecha_nacimiento: '2999-01-01', peso_kg: -3,
        });
        expect(r.status).toBe(400);
        expect(r.body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['fecha_nacimiento', 'peso_kg']));
    });

    test('rechaza propietario inexistente', async () => {
        expect((await vet.post('/api/mascotas', { id_propietario: 999, nombre: 'X', especie: 'canino' })).status).toBe(400);
    });

    test('filtra por especie e incluye el nombre del propietario', async () => {
        const r = await vet.get('/api/mascotas?especie=canino');
        expect(r.body.datos.every((m) => m.especie === 'canino')).toBe(true);
        expect(r.body.datos[0]).toHaveProperty('nombre_propietario');
    });

    test('el propietario solo ve sus mascotas', async () => {
        const r = await carlos.get('/api/mascotas');
        expect(r.body.datos.every((m) => m.id_propietario === 2)).toBe(true);
        expect((await carlos.get('/api/mascotas/1')).status).toBe(403);
    });

    test('el detalle incluye propietario e historia', async () => {
        const r = await ana.get('/api/mascotas/1');
        expect(r.body.propietario.correo).toBe('ana@correo.com');
        expect(r.body.historia.numero).toBe('HC-000001');
    });

    test('el propietario edita su mascota pero no puede cambiar el dueño', async () => {
        expect((await ana.put('/api/mascotas/2', { peso_kg: 4.5 })).body.peso_kg).toBe(4.5);
        expect((await ana.put('/api/mascotas/2', { id_propietario: 2 })).status).toBe(403);
    });

    test('mascotas de un propietario', async () => {
        const r = await vet.get('/api/propietarios/1/mascotas');
        expect(r.status).toBe(200);
        expect(r.body.length).toBeGreaterThanOrEqual(2);
    });

    test('solo el personal elimina; es borrado lógico y la historia se conserva', async () => {
    expect((await ana.delete('/api/mascotas/2')).status).toBe(403);
    expect((await vet.delete('/api/mascotas/2')).status).toBe(204);
    expect((await vet.get('/api/mascotas?activo=false')).body.datos.map((m) => m.id_mascota)).toContain(2);

    // Verificar directamente que la historia clínica sigue almacenada
    const historia = await pool.query(
        'SELECT id_historia FROM historias_clinicas WHERE id_mascota = $1',
        [2]
    );

    expect(historia.rows.length).toBeGreaterThan(0);
    });

    test('desactivar un propietario desactiva su cuenta y sus mascotas', async () => {
        expect((await vet.delete('/api/propietarios/2')).status).toBe(204);
        expect((await vet.get('/api/mascotas?id_propietario=2&activo=false')).body.datos.length).toBeGreaterThan(0);
        const login = await request(app).post('/api/auth/login').send({ correo: 'carlos@correo.com', contrasena: 'Vet12345' });
        expect(login.status).toBe(403);   // el login existente responde "La cuenta está desactivada"
        expect((await carlos.get('/api/mascotas')).status).toBe(401); // su token anterior deja de servir
    });
});

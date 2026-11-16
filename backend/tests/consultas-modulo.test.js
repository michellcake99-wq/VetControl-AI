// Ep3-Hu13: módulo de consultas con examen clínico completo
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, vet2, ana, carlos, admin;
const examenCompleto = {
    motivo: 'Vómito y decaimiento',
    anamnesis: 'Desde ayer no come',
    peso_kg: 27.9,
    temperatura_c: 39.4,
    frecuencia_cardiaca: 110,
    frecuencia_respiratoria: 28,
    pulso: 108,
    tiempo_llenado_capilar: 2,
    ganglios_linfaticos: 'Submandibulares levemente aumentados',
    mucosas: 'Rosadas, húmedas',
    actitud: 'letargico',
    organos_sistemas: { estado_general: 'AN', hidratacion: 'AN', digestivo: 'AN', ojos: 'N', oidos: 'NE' },
    examen_fisico: 'Dolor a la palpación abdominal',
    diagnostico: 'Gastroenteritis aguda',
    observaciones: 'Dieta blanda 3 días',
};

beforeAll(async () => {
    await reiniciarBase();
    [vet, vet2, ana, carlos, admin] = await Promise.all(
        ['vet@vetcontrol.com', 'vet2@vetcontrol.com', 'ana@correo.com', 'carlos@correo.com', 'admin@vetcontrol.com']
            .map(async (c) => api(await iniciarSesion(c)))
    );
});
afterAll(() => pool.end());

let idConsulta;

describe('Registro con examen clínico completo', () => {
    test('el veterinario registra la consulta con todos los campos del formato', async () => {
        const r = await vet.post('/api/historias/1/consultas', examenCompleto);
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({
            pulso: 108, actitud: 'letargico', mucosas: 'Rosadas, húmedas',
            organos_sistemas: { estado_general: 'AN', ojos: 'N', oidos: 'NE' },
        });
        expect(r.body.fecha).toBeTruthy(); // fecha y hora quedan registradas
        idConsulta = r.body.id_consulta;
    });

    test('valida órganos y sistemas (solo N, AN o NE y órganos conocidos) y la actitud', async () => {
        const base = { motivo: 'X', diagnostico: 'Y' };
        expect((await vet.post('/api/historias/1/consultas', { ...base, organos_sistemas: { ojos: 'BIEN' } })).status).toBe(400);
        expect((await vet.post('/api/historias/1/consultas', { ...base, organos_sistemas: { cola: 'N' } })).status).toBe(400);
        expect((await vet.post('/api/historias/1/consultas', { ...base, actitud: 'feliz' })).status).toBe(400);
    });

    test('el propietario y el administrador no pueden registrar consultas', async () => {
        const base = { motivo: 'X', diagnostico: 'Y' };
        expect((await ana.post('/api/historias/1/consultas', base)).status).toBe(403);
        expect((await admin.post('/api/historias/1/consultas', base)).status).toBe(403);
    });
});

describe('Listado general de consultas', () => {
    test('requiere sesión', async () => {
        expect((await request(app).get('/api/consultas')).status).toBe(401);
    });

    test('muestra fecha y hora, paciente, historia y veterinario, la más reciente primero', async () => {
        const r = await vet.get('/api/consultas');
        expect(r.status).toBe(200);
        expect(r.body.datos[0]).toMatchObject({
            id_consulta: idConsulta, nombre_mascota: 'Max', numero_historia: 'HC-000001',
            nombre_veterinario: 'Laura Quintero', motivo: 'Vómito y decaimiento',
        });
        const fechas = r.body.datos.map((c) => new Date(c.fecha).getTime());
        expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });

    test('el propietario solo ve las consultas de sus mascotas; el administrador ve todas', async () => {
        const deAna = (await ana.get('/api/consultas')).body.datos;
        expect(deAna.length).toBeGreaterThan(0);
        expect(deAna.every((c) => ['Max', 'Luna'].includes(c.nombre_mascota))).toBe(true);
        expect((await carlos.get('/api/consultas')).body.datos.every((c) => c.nombre_mascota === 'Rocky')).toBe(true);
        expect((await admin.get('/api/consultas')).body.meta.total).toBe((await vet.get('/api/consultas')).body.meta.total);
    });

    test('filtra por mascota, texto y fechas', async () => {
        expect((await vet.get('/api/consultas?id_mascota=1')).body.datos.every((c) => c.id_mascota === 1)).toBe(true);
        expect((await vet.get('/api/consultas?q=gastro')).body.datos.map((c) => c.id_consulta)).toContain(idConsulta);
        expect((await vet.get('/api/consultas?desde=2999-01-01')).body.datos).toHaveLength(0);
        expect((await vet.get('/api/consultas?desde=ayer')).status).toBe(400);
    });
});

describe('Hoja de la consulta', () => {
    test('trae los datos del paciente, del propietario y el número de historia', async () => {
        const r = await ana.get(`/api/consultas/${idConsulta}`);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({
            numero_historia: 'HC-000001', nombre_veterinario: 'Laura Quintero',
            mascota: { nombre: 'Max', especie: 'canino' }, propietario: { nombre: 'Ana', correo: 'ana@correo.com' },
        });
        expect(r.body.tratamientos).toEqual([]);
        expect(r.body.puede_editar).toBe(false);
        expect((await vet.get(`/api/consultas/${idConsulta}`)).body.puede_editar).toBe(true);
        expect((await vet2.get(`/api/consultas/${idConsulta}`)).body.puede_editar).toBe(false);
    });

    test('un propietario no puede ver la consulta de una mascota ajena', async () => {
        expect((await carlos.get(`/api/consultas/${idConsulta}`)).status).toBe(403);
    });

    test('solo el veterinario que la registró la puede editar', async () => {
        expect((await vet2.put(`/api/consultas/${idConsulta}`, { pulso: 100 })).status).toBe(403);
        const r = await vet.put(`/api/consultas/${idConsulta}`, { pulso: 100, organos_sistemas: { ojos: 'AN' } });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ pulso: 100, organos_sistemas: { ojos: 'AN' } });
    });
});

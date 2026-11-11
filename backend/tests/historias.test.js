// Ep3-Hu8: API de historias clínicas
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, vet2, admin, ana, carlos;
beforeAll(async () => {
    await reiniciarBase();
    vet = api(await iniciarSesion('vet@vetcontrol.com'));     // id_veterinario 1
    vet2 = api(await iniciarSesion('vet2@vetcontrol.com'));
    admin = api(await iniciarSesion('admin@vetcontrol.com'));
    ana = api(await iniciarSesion('ana@correo.com'));
    carlos = api(await iniciarSesion('carlos@correo.com'));
});
afterAll(() => pool.end());

describe('Historia clínica', () => {
    test('el veterinario obtiene la historia completa desde la mascota', async () => {
        const r = await vet.get('/api/mascotas/1/historia');
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ numero: 'HC-000001', alergias: 'Penicilina', mascota: { nombre: 'Max' } });
        expect(r.body.consultas[0]).toMatchObject({ nombre_veterinario: 'Laura Quintero' });
        expect(r.body.consultas[0].tratamientos[0].medicamento).toBe('Meloxicam');
        expect(r.body.vacunas).toHaveLength(2);
        expect(r.body.resumen).toMatchObject({ total_consultas: 1, tratamientos_activos: 1, vacunas_pendientes: 2 });
    });

    test('el propietario ve la historia de su mascota pero no la de otra', async () => {
        expect((await ana.get('/api/historias/1')).status).toBe(200);
        expect((await carlos.get('/api/historias/1')).status).toBe(403);
    });

    test('el administrador puede consultar pero no editar la historia', async () => {
        expect((await admin.get('/api/historias/1')).status).toBe(200);
        expect((await admin.put('/api/historias/1', { alergias: 'x' })).status).toBe(403);
    });

    test('solo el veterinario actualiza antecedentes y alergias', async () => {
        expect((await ana.put('/api/historias/1', { alergias: 'Ninguna' })).status).toBe(403);
        const r = await vet.put('/api/historias/1', { alergias: 'Penicilina, pollo' });
        expect(r.body.alergias).toBe('Penicilina, pollo');
    });

    test('historia inexistente responde 404', async () => {
        expect((await vet.get('/api/historias/999')).status).toBe(404);
    });
});

describe('Consultas', () => {
    let idConsulta;

    test('registra consulta asociada a una cita: la cita queda atendida y el peso se actualiza', async () => {
        const r = await vet.post('/api/historias/3/consultas', {
            id_cita: 2, motivo: 'Revisión de piel', peso_kg: 23.1, temperatura_c: 38.9,
            frecuencia_cardiaca: 100, diagnostico: 'Dermatitis alérgica', proximo_control: '2026-12-01',
        });
        expect(r.status).toBe(201);
        idConsulta = r.body.id_consulta;
        expect(r.body).toMatchObject({ id_veterinario: 1, id_historia: 3, diagnostico: 'Dermatitis alérgica' });
        expect((await pool.query('SELECT estado FROM citas WHERE id_cita = 2')).rows[0].estado).toBe('atendida');
        expect((await vet.get('/api/mascotas/3')).body.peso_kg).toBe(23.1);
    });

    test('rechaza una cita de otra mascota', async () => {
        expect((await vet.post('/api/historias/2/consultas', { id_cita: 1, motivo: 'X', diagnostico: 'Y' })).status).toBe(400);
    });

    test('valida diagnóstico obligatorio y signos vitales', async () => {
        const r = await vet.post('/api/historias/1/consultas', { motivo: 'X', temperatura_c: 80 });
        expect(r.status).toBe(400);
        expect(r.body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['diagnostico', 'temperatura_c']));
    });

    test('un propietario no puede registrar consultas', async () => {
        expect((await ana.post('/api/historias/1/consultas', { motivo: 'X', diagnostico: 'Y' })).status).toBe(403);
    });

    test('lista consultas paginadas y filtradas por fecha', async () => {
        const r = await vet.get('/api/historias/1/consultas?desde=2000-01-01');
        expect(r.body.meta.total).toBe(1);
        expect(r.body.datos[0].nombre_veterinario).toBe('Laura Quintero');
    });

    test('solo el veterinario autor edita la consulta', async () => {
        expect((await vet2.put(`/api/consultas/${idConsulta}`, { observaciones: 'x' })).status).toBe(403);
        const r = await vet.put(`/api/consultas/${idConsulta}`, { observaciones: 'Usar champú medicado' });
        expect(r.body.observaciones).toBe('Usar champú medicado');
    });
});

describe('Tratamientos y evolución', () => {
    let idTratamiento;

    test('el veterinario agrega un tratamiento a una consulta', async () => {
        const r = await vet.post('/api/consultas/1/tratamientos', {
            medicamento: 'Omega 3', dosis: '1 cápsula', frecuencia: 'cada 24 horas', via: 'oral',
            fecha_inicio: '2026-11-01', fecha_fin: '2026-12-01',
        });
        expect(r.status).toBe(201);
        expect(r.body.estado).toBe('activo');
        idTratamiento = r.body.id_tratamiento;
    });

    test('rechaza fecha_fin anterior a fecha_inicio', async () => {
        const r = await vet.post('/api/consultas/1/tratamientos', {
            medicamento: 'X', dosis: '1', frecuencia: 'diaria', fecha_inicio: '2026-11-10', fecha_fin: '2026-11-01',
        });
        expect(r.status).toBe(400);
    });

    test('lista tratamientos activos de la historia', async () => {
        const r = await ana.get('/api/historias/1/tratamientos?estado=activo');
        expect(r.body.map((t) => t.medicamento)).toEqual(expect.arrayContaining(['Meloxicam', 'Omega 3']));
    });

    test('el propietario registra la evolución del tratamiento de su mascota', async () => {
        const r = await ana.post(`/api/tratamientos/${idTratamiento}/evoluciones`, { estado_general: 5, descripcion: 'Pelaje más brillante' });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ estado_general: 5, dosis_aplicada: true });
        expect((await vet.get(`/api/tratamientos/${idTratamiento}/evoluciones`)).body).toHaveLength(1);
    });

    test('otro propietario y el veterinario no pueden registrar evolución', async () => {
        const body = { estado_general: 3, descripcion: 'x' };
        expect((await carlos.post(`/api/tratamientos/${idTratamiento}/evoluciones`, body)).status).toBe(403);
        expect((await vet.post(`/api/tratamientos/${idTratamiento}/evoluciones`, body)).status).toBe(403);
    });

    test('un tratamiento finalizado ya no admite evoluciones', async () => {
        expect((await vet.put(`/api/tratamientos/${idTratamiento}`, { estado: 'finalizado' })).body.estado).toBe('finalizado');
        const r = await ana.post(`/api/tratamientos/${idTratamiento}/evoluciones`, { estado_general: 4, descripcion: 'x' });
        expect(r.status).toBe(409);
    });
});

describe('Auditoría desde la API', () => {
    test('guarda el usuario de la aplicación que registró y modificó la consulta', async () => {
        const nueva = await vet.post('/api/historias/1/consultas', { motivo: 'Control', diagnostico: 'Sano' });
        await vet.put(`/api/consultas/${nueva.body.id_consulta}`, { diagnostico: 'Sano, bajar de peso' });
        const { rows } = await pool.query(
            `SELECT a.accion, a.detalle, u.correo FROM auditoria a JOIN usuarios u ON u.id_usuario = a.id_usuario
              WHERE a.tabla_afectada = 'consultas' AND a.id_registro = $1 ORDER BY a.id_auditoria`,
            [String(nueva.body.id_consulta)]
        );
        expect(rows.map((r) => [r.accion, r.correo])).toEqual([
            ['INSERT', 'vet@vetcontrol.com'],
            ['UPDATE', 'vet@vetcontrol.com'],
        ]);
        expect(rows[1].detalle.antes.diagnostico).toBe('Sano');
        expect(rows[1].detalle.despues.diagnostico).toBe('Sano, bajar de peso');
    });
});

describe('Vacunas', () => {
    test('el veterinario registra una vacuna', async () => {
        const r = await vet.post('/api/historias/2/vacunas', {
            nombre: 'Leucemia felina', laboratorio: 'Zoetis', fecha_aplicacion: '2026-11-10', proxima_dosis: '2027-11-10',
        });
        expect(r.status).toBe(201);
        expect(r.body.id_veterinario).toBe(1);
    });

    test('rechaza próxima dosis anterior a la aplicación', async () => {
        const r = await vet.post('/api/historias/2/vacunas', { nombre: 'X', fecha_aplicacion: '2026-11-10', proxima_dosis: '2026-01-01' });
        expect(r.status).toBe(400);
    });

    test('el propietario consulta el carnet de vacunas de su mascota', async () => {
        const r = await ana.get('/api/historias/2/vacunas');
        expect(r.body).toHaveLength(2);
    });
});

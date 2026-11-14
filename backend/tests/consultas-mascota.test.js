// Ep3-Hu9: consultas y tratamientos de una mascota
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, vet2, admin, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  vet2 = api(await iniciarSesion('vet2@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
});
afterAll(() => pool.end());

describe('Registrar consultas', () => {
  test('el veterinario registra una consulta con signos vitales en la historia de la mascota', async () => {
    const r = await vet.post('/api/historias/2/consultas', {
      motivo: 'Vómito', diagnostico: 'Gastritis leve', observaciones: 'Dieta blanda por 3 días',
      peso_kg: 4.3, temperatura_c: 38.7,
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id_historia: 2, id_veterinario: 1, peso_kg: 4.3, temperatura_c: 38.7 });
  });

  test('valida peso mayor a cero, temperatura razonable y diagnóstico obligatorio', async () => {
    const r = await vet.post('/api/historias/2/consultas', { motivo: 'X', diagnostico: 'Y', peso_kg: 0, temperatura_c: 50 });
    expect(r.status).toBe(400);
    expect(r.body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['peso_kg', 'temperatura_c']));
    expect((await vet.post('/api/historias/2/consultas', { motivo: 'X' })).status).toBe(400);
  });

  test('el propietario y el administrador no pueden crear consultas', async () => {
    expect((await ana.post('/api/historias/1/consultas', { motivo: 'X', diagnostico: 'Y' })).status).toBe(403);
    expect((await admin.post('/api/historias/1/consultas', { motivo: 'X', diagnostico: 'Y' })).status).toBe(403);
  });
});

describe('Tratamientos de una consulta', () => {
  let idConsulta;
  beforeAll(async () => {
    idConsulta = (await vet.post('/api/historias/1/consultas', { motivo: 'Control', diagnostico: 'Sano' })).body.id_consulta;
  });

  test('agrega varios tratamientos a la misma consulta', async () => {
    const a = await vet.post(`/api/consultas/${idConsulta}/tratamientos`, {
      medicamento: 'Amoxicilina', dosis: '10 mg/kg', frecuencia: 'cada 12 horas', via: 'oral',
      fecha_inicio: '2026-11-10', fecha_fin: '2026-11-17', indicaciones: 'Con comida',
    });
    const b = await vet.post(`/api/consultas/${idConsulta}/tratamientos`, {
      medicamento: 'Probiótico', dosis: '1 sobre', frecuencia: 'cada 24 horas',
    });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.estado).toBe('activo');
    expect((await vet.get(`/api/consultas/${idConsulta}`)).body.tratamientos).toHaveLength(2);
  });

  test('valida que fecha_fin no sea anterior a fecha_inicio, también al editar', async () => {
    const mal = await vet.post(`/api/consultas/${idConsulta}/tratamientos`, {
      medicamento: 'X', dosis: '1', frecuencia: 'diaria', fecha_inicio: '2026-11-10', fecha_fin: '2026-11-01',
    });
    expect(mal.status).toBe(400);
    expect(mal.body.detalles[0].campo).toBe('fecha_fin');
    const t = (await vet.get(`/api/consultas/${idConsulta}`)).body.tratamientos[0];
    expect((await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { fecha_fin: '2020-01-01' })).status).toBe(400);
  });

  test('cambia el estado del tratamiento (activo, suspendido, finalizado) y rechaza otros valores', async () => {
    const t = (await vet.get(`/api/consultas/${idConsulta}`)).body.tratamientos[0];
    expect((await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'suspendido' })).body.estado).toBe('suspendido');
    expect((await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'activo' })).body.estado).toBe('activo');
    expect((await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'finalizado' })).body.estado).toBe('finalizado');
    expect((await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'borrado' })).status).toBe(400);
  });

  test('solo el veterinario crea o modifica tratamientos; el propietario solo consulta', async () => {
    const cuerpo = { medicamento: 'X', dosis: '1', frecuencia: 'diaria' };
    expect((await ana.post(`/api/consultas/${idConsulta}/tratamientos`, cuerpo)).status).toBe(403);
    expect((await admin.post(`/api/consultas/${idConsulta}/tratamientos`, cuerpo)).status).toBe(403);
    const t = (await vet.get(`/api/consultas/${idConsulta}`)).body.tratamientos[0];
    expect((await ana.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'activo' })).status).toBe(403);
    expect((await ana.get(`/api/consultas/${idConsulta}`)).status).toBe(200);
    expect((await carlos.get(`/api/consultas/${idConsulta}`)).status).toBe(403);
  });
});

describe('Listados por mascota', () => {
  test('el propietario lista las consultas de su mascota', async () => {
    const r = await ana.get('/api/mascotas/1/consultas');
    expect(r.status).toBe(200);
    expect(r.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(r.body.datos[0]).toMatchObject({ nombre_veterinario: expect.any(String), total_tratamientos: expect.any(Number) });
    // más recientes primero
    const fechas = r.body.datos.map((c) => new Date(c.fecha).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  test('filtra las consultas por fechas y valida el formato', async () => {
    expect((await vet.get('/api/mascotas/1/consultas?desde=2999-01-01')).body.meta.total).toBe(0);
    expect((await vet.get('/api/mascotas/1/consultas?desde=2000-01-01&hasta=2999-01-01')).body.meta.total).toBeGreaterThanOrEqual(1);
    expect((await vet.get('/api/mascotas/1/consultas?desde=ayer')).status).toBe(400);
  });

  test('pagina las consultas', async () => {
    const r = await vet.get('/api/mascotas/1/consultas?limite=1&pagina=1');
    expect(r.body.datos).toHaveLength(1);
    expect(r.body.meta).toMatchObject({ pagina: 1, limite: 1 });
  });

  test('lista los tratamientos de la mascota y filtra por estado', async () => {
    const todos = await ana.get('/api/mascotas/1/tratamientos');
    expect(todos.status).toBe(200);
    expect(todos.body.map((t) => t.medicamento)).toEqual(expect.arrayContaining(['Meloxicam']));
    expect(todos.body[0]).toHaveProperty('diagnostico');
    const activos = await ana.get('/api/mascotas/1/tratamientos?estado=activo');
    expect(activos.body.every((t) => t.estado === 'activo')).toBe(true);
    expect((await ana.get('/api/mascotas/1/tratamientos?estado=otro')).status).toBe(400);
  });

  test('el propietario no ve los datos de la mascota de otro; el personal sí', async () => {
    expect((await carlos.get('/api/mascotas/1/consultas')).status).toBe(403);
    expect((await carlos.get('/api/mascotas/1/tratamientos')).status).toBe(403);
    expect((await vet2.get('/api/mascotas/1/consultas')).status).toBe(200);
    expect((await admin.get('/api/mascotas/1/tratamientos')).status).toBe(200);
    expect((await vet.get('/api/mascotas/999/consultas')).status).toBe(404);
  });
});

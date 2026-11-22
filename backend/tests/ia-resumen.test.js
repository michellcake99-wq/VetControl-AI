// Ep6-Hu2: resumen de la historia clínica con IA (el servicio externo se simula)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, carlos, vet;
const fetchOriginal = global.fetch;
const simularIA = (contenido = 'Antecedentes:\n- Displasia leve') => {
  const fn = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ model: 'modelo-prueba', choices: [{ message: { content: contenido } }] }) }));
  global.fetch = fn;
  return fn;
};

beforeAll(async () => {
  await reiniciarBase();
  ana = api(await iniciarSesion('ana@correo.com'));
  carlos = api(await iniciarSesion('carlos@correo.com'));
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
});
beforeEach(() => {
  process.env.IA_API_KEY = 'clave-de-prueba';
  process.env.IA_LIMITE_CONSULTAS = '20';
});
afterEach(() => {
  global.fetch = fetchOriginal;
});
afterAll(() => pool.end());

describe('POST /api/ia/resumir-historial', () => {
  test('exige token y una mascota válida', async () => {
    expect((await request(app).post('/api/ia/resumir-historial').send({ id_mascota: 1 })).status).toBe(401);
    expect((await ana.post('/api/ia/resumir-historial', {})).status).toBe(400);
    expect((await ana.post('/api/ia/resumir-historial', { id_mascota: 9999 })).status).toBe(404);
  });

  test('devuelve el resumen con el aviso de que lo generó la IA', async () => {
    simularIA('Antecedentes:\n- Displasia leve de cadera');
    const r = await ana.post('/api/ia/resumir-historial', { id_mascota: 1 });
    expect(r.status).toBe(200);
    expect(r.body.respuesta).toContain('Displasia leve');
    expect(r.body.aviso).toMatch(/inteligencia artificial/);
    expect(r.body.aviso).toMatch(/no reemplaza el criterio del veterinario/);
  });

  test('usa solo los datos de esa mascota y pide las cuatro secciones', async () => {
    const fetch = simularIA();
    await ana.post('/api/ia/resumir-historial', { id_mascota: 1 });
    const mensajes = JSON.parse(fetch.mock.calls[0][1].body).messages;
    const todo = mensajes.map((m) => m.content).join('\n');
    expect(todo).toContain('Max');
    expect(todo).not.toContain('Luna');
    expect(todo).not.toContain('Rocky');
    for (const seccion of ['Antecedentes:', 'Diagnósticos recientes:', 'Tratamientos activos:', 'Vacunas:']) {
      expect(mensajes[0].content).toContain(seccion);
    }
    expect(mensajes[0].content).toMatch(/ÚNICAMENTE los datos/);
  });

  test('un propietario no puede resumir la mascota de otro; el veterinario sí', async () => {
    simularIA();
    expect((await carlos.post('/api/ia/resumir-historial', { id_mascota: 1 })).status).toBe(403);
    expect((await vet.post('/api/ia/resumir-historial', { id_mascota: 1 })).status).toBe(200);
  });

  test('si la IA falla responde con un error claro y se puede reintentar', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'x' } }) }));
    const fallo = await ana.post('/api/ia/resumir-historial', { id_mascota: 1 });
    expect(fallo.status).toBe(502);
    expect(fallo.body.mensaje).toBeTruthy();
    simularIA();
    expect((await ana.post('/api/ia/resumir-historial', { id_mascota: 1 })).status).toBe(200);
  });

  test('queda registrado en las interacciones y cuenta para el límite', async () => {
    process.env.IA_LIMITE_CONSULTAS = '1';
    simularIA();
    await pool.query('TRUNCATE interacciones_ia');
    expect((await ana.post('/api/ia/resumir-historial', { id_mascota: 1 })).status).toBe(200);
    const { rows } = await pool.query('SELECT pregunta, exitosa, id_mascota FROM interacciones_ia');
    expect(rows).toEqual([{ pregunta: 'Resumen del historial de Max', exitosa: true, id_mascota: 1 }]);
    expect((await ana.post('/api/ia/resumir-historial', { id_mascota: 1 })).status).toBe(429);
  });
});

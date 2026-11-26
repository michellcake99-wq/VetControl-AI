// Ep4-Hu3: seguimiento de la evolución de la mascota (peso y observaciones)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, admin, ana, carlos, idAna;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
  idAna = (await pool.query("SELECT id_usuario FROM usuarios WHERE correo = 'ana@correo.com'")).rows[0].id_usuario;
});
afterAll(() => pool.end());

// Fecha local 'AAAA-MM-DD' de hace n días (negativo = en el futuro).
// Se usa la fecha local (no toISOString, que da UTC) para coincidir con la fecha que guarda el servidor.
const hace = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Consultar el seguimiento', () => {
  test('el veterinario ve los registros de Max, del más reciente al más antiguo', async () => {
    const r = await vet.get('/api/mascotas/1/seguimiento');
    expect(r.status).toBe(200);
    expect(r.body.mascota).toMatchObject({ id_mascota: 1, nombre: 'Max' });
    expect(r.body.datos).toHaveLength(3);
    const fechas = r.body.datos.map((d) => d.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    expect(r.body.datos[0]).toMatchObject({ peso_kg: 28.5, rol_registrador: 'veterinario' });
  });

  test('cada registro indica quién lo registró', async () => {
    const { datos } = (await vet.get('/api/mascotas/1/seguimiento')).body;
    const deAna = datos.find((d) => d.rol_registrador === 'propietario');
    expect(deAna).toMatchObject({ registrado_por: 'Ana Torres', id_usuario: idAna });
  });

  test('el propietario ve el seguimiento de su mascota y el administrador el de cualquiera', async () => {
    expect((await ana.get('/api/mascotas/1/seguimiento')).status).toBe(200);
    expect((await admin.get('/api/mascotas/1/seguimiento')).status).toBe(200);
  });

  test('una mascota sin registros devuelve la lista vacía', async () => {
    const r = await ana.get('/api/mascotas/2/seguimiento');
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
  });

  test('el propietario no ve el seguimiento de una mascota ajena (403)', async () => {
    expect((await ana.get('/api/mascotas/3/seguimiento')).status).toBe(403);
    expect((await carlos.get('/api/mascotas/1/seguimiento')).status).toBe(403);
  });

  test('mascota inexistente (404) y sin token (401)', async () => {
    expect((await vet.get('/api/mascotas/9999/seguimiento')).status).toBe(404);
    expect((await request(app).get('/api/mascotas/1/seguimiento')).status).toBe(401);
  });
});

describe('Registrar peso y observaciones', () => {
  test('el veterinario registra el peso y queda guardado quién lo hizo', async () => {
    const r = await vet.post('/api/mascotas/2/seguimiento', { peso_kg: 4.5, observaciones: 'Control de rutina' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      id_mascota: 2, peso_kg: 4.5, observaciones: 'Control de rutina',
      registrado_por: 'Laura Quintero', rol_registrador: 'veterinario',
    });
    expect(r.body.fecha).toBe(hace(0));
  });

  test('el propietario registra el peso de su mascota y queda como autor', async () => {
    const r = await ana.post('/api/mascotas/2/seguimiento', { peso_kg: 4.6, fecha: hace(1) });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id_usuario: idAna, rol_registrador: 'propietario', observaciones: null });
  });

  test('el peso actual de la mascota pasa a ser el del registro más reciente', async () => {
    // Luna: 4.5 (hoy, por la vet) y 4.6 (ayer, por Ana) -> el más reciente es el de hoy
    let { rows } = await pool.query('SELECT peso_kg FROM mascotas WHERE id_mascota = 2');
    expect(Number(rows[0].peso_kg)).toBe(4.5);
    // Un registro de una fecha anterior no cambia el peso actual
    await ana.post('/api/mascotas/2/seguimiento', { peso_kg: 3.9, fecha: hace(200) });
    ({ rows } = await pool.query('SELECT peso_kg FROM mascotas WHERE id_mascota = 2'));
    expect(Number(rows[0].peso_kg)).toBe(4.5);
  });

  test('el listado de la mascota incluye lo recién registrado, en orden', async () => {
    const { datos } = (await ana.get('/api/mascotas/2/seguimiento')).body;
    expect(datos.map((d) => d.peso_kg)).toEqual([4.5, 4.6, 3.9]);
  });

  test('el peso debe ser mayor que cero y numérico (400)', async () => {
    for (const peso_kg of [0, -3, 'abc', null]) {
      const r = await ana.post('/api/mascotas/1/seguimiento', { peso_kg });
      expect(r.status).toBe(400);
      expect(r.body.detalles[0].campo).toBe('peso_kg');
    }
    expect((await ana.post('/api/mascotas/1/seguimiento', {})).status).toBe(400);
  });

  test('la fecha no puede ser futura ni tener formato inválido (400)', async () => {
    const futura = await ana.post('/api/mascotas/1/seguimiento', { peso_kg: 28, fecha: hace(-3) });
    expect(futura.status).toBe(400);
    expect(futura.body.detalles[0].campo).toBe('fecha');
    expect((await ana.post('/api/mascotas/1/seguimiento', { peso_kg: 28, fecha: '15/03/2026' })).status).toBe(400);
  });

  test('las observaciones tienen un máximo de 1000 caracteres (400)', async () => {
    const r = await ana.post('/api/mascotas/1/seguimiento', { peso_kg: 28, observaciones: 'a'.repeat(1001) });
    expect(r.status).toBe(400);
  });

  test('el propietario no puede registrar en una mascota ajena (403) y no se guarda nada', async () => {
    const antes = (await vet.get('/api/mascotas/1/seguimiento')).body.datos.length;
    const r = await carlos.post('/api/mascotas/1/seguimiento', { peso_kg: 30 });
    expect(r.status).toBe(403);
    expect((await vet.get('/api/mascotas/1/seguimiento')).body.datos).toHaveLength(antes);
  });

  test('registrar en una mascota inexistente responde 404', async () => {
    expect((await vet.post('/api/mascotas/9999/seguimiento', { peso_kg: 10 })).status).toBe(404);
  });
});
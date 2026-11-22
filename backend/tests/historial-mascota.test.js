// Ep4-Hu2: historial médico cronológico de la mascota (consultas, tratamientos y vacunas)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, admin, ana, carlos, marta;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
  marta = api(await iniciarSesion('marta@correo.com')); // dueña de Kiwi (4), sin registros
});
afterAll(() => pool.end());

const tipos = (r) => r.body.datos.map((e) => e.tipo);

describe('Historial de la mascota (propietario)', () => {
  test('el propietario ve consultas, tratamientos y vacunas de su mascota, lo más reciente primero', async () => {
    const r = await ana.get('/api/mascotas/1/historial');
    expect(r.status).toBe(200);
    expect(r.body.mascota).toMatchObject({ id_mascota: 1, nombre: 'Max' });
    expect(r.body.resumen).toEqual({ consulta: 1, tratamiento: 1, vacuna: 2 });
    expect(r.body.meta.total).toBe(4);
    // Las vacunas de hace 300 días van al final; la consulta y el tratamiento (hace 10 días) arriba
    expect(tipos(r)).toHaveLength(4);
    expect(tipos(r).slice(2)).toEqual(['vacuna', 'vacuna']);
    expect(new Set(tipos(r))).toEqual(new Set(['consulta', 'tratamiento', 'vacuna']));
    const fechas = r.body.datos.map((e) => e.fecha);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  test('cada tipo trae título, detalle y los datos propios de su tipo', async () => {
    const { datos } = (await ana.get('/api/mascotas/1/historial')).body;
    const consulta = datos.find((e) => e.tipo === 'consulta');
    expect(consulta).toMatchObject({ titulo: 'Control anual', detalle: expect.stringContaining('Inflamación') });
    expect(consulta.extra.veterinario).toBeTruthy();
    expect(consulta.extra.total_tratamientos).toBe(1);

    const tratamiento = datos.find((e) => e.tipo === 'tratamiento');
    expect(tratamiento).toMatchObject({ titulo: 'Meloxicam', estado: 'activo', id_consulta: consulta.id_consulta });
    expect(tratamiento.detalle).toBe('0.1 mg/kg · cada 24 horas · oral');

    const vacuna = datos.find((e) => e.tipo === 'vacuna' && e.titulo === 'Rabia');
    expect(vacuna).toMatchObject({ titulo: 'Rabia' });
    expect(vacuna.extra).toMatchObject({ laboratorio: 'Zoetis', lote: 'RB-2291' });
  });

  test('puede verse del más antiguo al más reciente', async () => {
    const r = await ana.get('/api/mascotas/1/historial?orden=asc');
    expect(tipos(r)[0]).toBe('vacuna');
    const fechas = r.body.datos.map((e) => e.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  test('filtra por tipo de registro; el resumen sigue mostrando todos los tipos', async () => {
    for (const [tipo, cantidad] of [['consulta', 1], ['tratamiento', 1], ['vacuna', 2]]) {
      const r = await ana.get(`/api/mascotas/1/historial?tipo=${tipo}`);
      expect(r.status).toBe(200);
      expect(tipos(r)).toEqual(Array(cantidad).fill(tipo));
      expect(r.body.meta.total).toBe(cantidad);
      expect(r.body.resumen).toEqual({ consulta: 1, tratamiento: 1, vacuna: 2 });
    }
  });

  test('un tipo inválido responde 400', async () => {
    const r = await ana.get('/api/mascotas/1/historial?tipo=cita');
    expect(r.status).toBe(400);
  });
});

describe('Filtro por rango de fechas', () => {
  beforeAll(async () => {
    // Consultas antiguas en la historia de Max, con fechas conocidas
    await pool.query(
      `INSERT INTO consultas (id_historia, id_veterinario, fecha, motivo, diagnostico) VALUES
         (1, 1, '2024-03-10 15:00-05', 'Vómito', 'Gastritis leve'),
         (1, 1, '2024-05-20 09:00-05', 'Herida en pata', 'Corte superficial'),
         (1, 1, '2024-05-20 23:30-05', 'Seguimiento de herida', 'Cicatriza bien')`
    );
    await pool.query(
      `INSERT INTO vacunas (id_historia, id_veterinario, nombre, fecha_aplicacion) VALUES (1, 1, 'Bordetella', '2024-05-20')`
    );
  });

  test('desde y hasta incluyen los días indicados (un solo día = desde y hasta iguales)', async () => {
    const r = await ana.get('/api/mascotas/1/historial?desde=2024-05-20&hasta=2024-05-20');
    expect(r.status).toBe(200);
    expect(r.body.datos.map((e) => e.titulo).sort()).toEqual(['Bordetella', 'Herida en pata', 'Seguimiento de herida']);
    expect(r.body.meta.total).toBe(3);
  });

  test('un registro de la noche (hora de Colombia) cuenta en su día y no en el siguiente', async () => {
    const r = await ana.get('/api/mascotas/1/historial?desde=2024-05-21&hasta=2024-05-21');
    expect(r.body.datos).toHaveLength(0);
  });

  test('solo «desde» o solo «hasta» funcionan por separado', async () => {
    const antes = await ana.get('/api/mascotas/1/historial?hasta=2024-12-31');
    expect(antes.body.datos.map((e) => e.titulo).sort()).toEqual(
      ['Bordetella', 'Herida en pata', 'Seguimiento de herida', 'Vómito']
    );
    expect(antes.body.datos.every((e) => e.fecha <= '2024-12-31')).toBe(true);
    const despues = await ana.get('/api/mascotas/1/historial?desde=2025-01-01');
    expect(despues.body.datos.every((e) => e.fecha >= '2025-01-01')).toBe(true);
    expect(despues.body.datos.map((e) => e.titulo)).toEqual(expect.arrayContaining(['Control anual', 'Meloxicam', 'Rabia']));
  });

  test('combina rango de fechas y tipo; el resumen cuenta el rango sin importar el tipo', async () => {
    const r = await ana.get('/api/mascotas/1/historial?tipo=consulta&desde=2024-01-01&hasta=2024-12-31');
    expect(tipos(r)).toEqual(['consulta', 'consulta', 'consulta']);
    expect(r.body.meta.total).toBe(3);
    expect(r.body.resumen).toEqual({ consulta: 3, tratamiento: 0, vacuna: 1 });
  });

  test('dentro de un mismo día se ordena por hora', async () => {
    const r = await ana.get('/api/mascotas/1/historial?tipo=consulta&desde=2024-05-20&hasta=2024-05-20');
    expect(r.body.datos.map((e) => e.titulo)).toEqual(['Seguimiento de herida', 'Herida en pata']);
  });

  test('fechas con formato inválido, inexistentes o invertidas responden 400', async () => {
    expect((await ana.get('/api/mascotas/1/historial?desde=20-05-2024')).status).toBe(400);
    expect((await ana.get('/api/mascotas/1/historial?hasta=2024-02-31')).status).toBe(400);
    const invertido = await ana.get('/api/mascotas/1/historial?desde=2024-06-01&hasta=2024-05-01');
    expect(invertido.status).toBe(400);
    expect(invertido.body.mensaje).toMatch(/desde/);
  });

  test('un rango sin registros devuelve lista vacía (no un error)', async () => {
    const r = await ana.get('/api/mascotas/1/historial?desde=2000-01-01&hasta=2000-12-31');
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.meta.total).toBe(0);
    expect(r.body.resumen).toEqual({ consulta: 0, tratamiento: 0, vacuna: 0 });
  });
});

describe('Paginación', () => {
  test('devuelve el historial por páginas sin repetir registros', async () => {
    const p1 = await ana.get('/api/mascotas/1/historial?limite=3&pagina=1');
    const p2 = await ana.get('/api/mascotas/1/historial?limite=3&pagina=2');
    expect(p1.body.datos).toHaveLength(3);
    expect(p1.body.meta).toMatchObject({ pagina: 1, limite: 3, total: 8, total_paginas: 3 });
    const clave = (e) => `${e.tipo}-${e.id}`;
    const repetidos = p2.body.datos.map(clave).filter((k) => p1.body.datos.map(clave).includes(k));
    expect(repetidos).toEqual([]);
    expect(p2.body.datos).toHaveLength(3);
  });
});

describe('Acceso y solo lectura', () => {
  test('el propietario no ve el historial de mascotas de otra persona', async () => {
    expect((await ana.get('/api/mascotas/3/historial')).status).toBe(403);
    expect((await carlos.get('/api/mascotas/1/historial')).status).toBe(403);
    expect((await carlos.get('/api/mascotas/3/historial')).status).toBe(200);
  });

  test('el veterinario y el administrador pueden verlo', async () => {
    expect((await vet.get('/api/mascotas/1/historial')).status).toBe(200);
    expect((await admin.get('/api/mascotas/2/historial')).status).toBe(200);
  });

  test('una mascota inexistente responde 404 y sin sesión 401', async () => {
    expect((await ana.get('/api/mascotas/9999/historial')).status).toBe(404);
    expect((await request(app).get('/api/mascotas/1/historial')).status).toBe(401);
  });

  test('una mascota sin registros devuelve lista vacía para que la pantalla muestre el mensaje', async () => {
    const r = await marta.get('/api/mascotas/4/historial');
    expect(r.status).toBe(200);
    expect(r.body.datos).toEqual([]);
    expect(r.body.resumen).toEqual({ consulta: 0, tratamiento: 0, vacuna: 0 });
    expect(r.body.mascota.nombre).toBe('Kiwi');
  });

  test('es de solo lectura: no existen POST, PUT ni DELETE sobre el historial', async () => {
    expect((await ana.post('/api/mascotas/1/historial', { titulo: 'x' })).status).toBe(404);
    expect((await ana.put('/api/mascotas/1/historial', { titulo: 'x' })).status).toBe(404);
    expect((await ana.delete('/api/mascotas/1/historial')).status).toBe(404);
  });
});

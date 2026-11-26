// Ep5-Hu4: visualización de los pendientes de la mascota
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let vet, admin, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
  base = (await pool.query('SELECT CURRENT_DATE::text AS hoy')).rows[0].hoy;
});
afterAll(() => pool.end());

// Fecha 'AAAA-MM-DD' dentro de n días (negativo = en el pasado), tomando como base el CURRENT_DATE de la
// base de datos (el mismo que usan los datos de ejemplo), para no depender de la zona horaria del equipo
let base;
const dia = (n) => new Date(Date.parse(`${base}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tipos = (cuerpo) => cuerpo.datos.map((p) => `${p.tipo}:${p.titulo}`);

describe('Contenido de los pendientes (datos de ejemplo)', () => {
  test('Max: su tratamiento activo y sus dos vacunas por aplicar, con fecha y estado', async () => {
    const r = await ana.get('/api/mascotas/1/pendientes');
    expect(r.status).toBe(200);
    expect(r.body.mascota).toMatchObject({ id_mascota: 1, nombre: 'Max' });
    expect(r.body.total).toBe(3);
    expect(r.body.vencidos).toBe(0);
    expect(tipos(r.body)).toEqual(['tratamiento:Meloxicam', 'vacuna:Rabia', 'vacuna:Pentavalente canina']);
    for (const p of r.body.datos) {
      expect(p.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.estado).toBe('proximo');
    }
    // El tratamiento se muestra con su fecha de fin y los datos de la dosis
    expect(r.body.datos[0]).toMatchObject({ fecha: dia(4), dosis: '0.1 mg/kg', frecuencia: 'cada 24 horas', id_consulta: 1 });
  });

  test('una cita futura aparece como próxima; las atendidas o canceladas no aparecen', async () => {
    const r = await carlos.get('/api/mascotas/3/pendientes'); // Rocky: cita programada en 3 días
    expect(r.status).toBe(200);
    expect(r.body.datos).toHaveLength(1);
    expect(r.body.datos[0]).toMatchObject({
      tipo: 'cita', titulo: 'Revisión de piel', estado: 'proximo', estado_cita: 'programada',
    });
    // La fecha de la cita es la de Colombia, así que puede diferir un día del CURRENT_DATE del servidor
    expect([dia(2), dia(3)]).toContain(r.body.datos[0].fecha);
    expect(r.body.datos[0].nombre_veterinario).toBeTruthy();
    // La cita atendida de Max (hace 10 días) no es un pendiente
    const max = (await ana.get('/api/mascotas/1/pendientes')).body;
    expect(max.datos.some((p) => p.tipo === 'cita')).toBe(false);
  });

  test('una mascota sin nada pendiente devuelve la lista vacía y sin porcentaje', async () => {
    const r = await vet.get('/api/mascotas/4/pendientes'); // Kiwi
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 0, vencidos: 0, datos: [] });
    expect(r.body.vacunas).toEqual({ total: 0, al_dia: 0, porcentaje: null });
  });
});

describe('Estado, orden y vencidos', () => {
  let idCitaCancelada;
  beforeAll(async () => {
    // Luna (historia 2): una Rabia cuya próxima dosis ya pasó (vencida) y una cita futura
    await pool.query(
      `INSERT INTO vacunas (id_historia, id_veterinario, id_catalogo, nombre, fecha_aplicacion, proxima_dosis)
       SELECT 2, 1, id_catalogo, nombre, CURRENT_DATE - 400, CURRENT_DATE - 35
         FROM catalogo_vacunas WHERE nombre = 'Rabia'`
    );
    await pool.query(
      `INSERT INTO citas (id_mascota, id_veterinario, fecha_hora, motivo, tipo_consulta, estado)
       VALUES (2, 1, now() + interval '2 days', 'Control de peso', 'control', 'confirmada')`
    );
    idCitaCancelada = (
      await pool.query(
        `INSERT INTO citas (id_mascota, id_veterinario, fecha_hora, motivo, tipo_consulta, estado)
         VALUES (2, 1, now() + interval '1 day', 'Cita cancelada', 'control', 'cancelada') RETURNING id_cita`
      )
    ).rows[0].id_cita;
  });

  test('los pendientes salen ordenados por fecha y los vencidos van primero', async () => {
    const r = await ana.get('/api/mascotas/2/pendientes');
    expect(r.status).toBe(200);
    expect(tipos(r.body)).toEqual(['vacuna:Rabia', 'cita:Control de peso', 'vacuna:Triple felina']);
    const fechas = r.body.datos.map((p) => p.fecha);
    expect([...fechas].sort()).toEqual(fechas);
    expect(r.body.datos.map((p) => p.estado)).toEqual(['vencido', 'proximo', 'proximo']);
    expect(r.body.vencidos).toBe(1);
  });

  test('una cita cancelada no es un pendiente', async () => {
    const r = await ana.get('/api/mascotas/2/pendientes');
    expect(r.body.datos.some((p) => p.tipo === 'cita' && p.id === idCitaCancelada)).toBe(false);
  });

  test('un tratamiento activo con la fecha de fin vencida se marca como vencido', async () => {
    await pool.query('UPDATE tratamientos SET fecha_fin = CURRENT_DATE - 3 WHERE id_tratamiento = 1');
    const r = await ana.get('/api/mascotas/1/pendientes');
    const t = r.body.datos.find((p) => p.tipo === 'tratamiento');
    expect(t).toMatchObject({ estado: 'vencido', fecha: dia(-3) });
    expect(r.body.datos[0].tipo).toBe('tratamiento'); // vencido: primero de la lista
    expect(r.body.vencidos).toBe(1);
  });

  test('un tratamiento sin fecha de fin está en curso (próximo) y muestra su inicio', async () => {
    await pool.query('UPDATE tratamientos SET fecha_fin = NULL WHERE id_tratamiento = 1');
    const t = (await ana.get('/api/mascotas/1/pendientes')).body.datos.find((p) => p.tipo === 'tratamiento');
    expect(t).toMatchObject({ estado: 'proximo', fecha: dia(-10), fecha_fin: null });
  });

  test('un tratamiento finalizado deja de ser un pendiente', async () => {
    await pool.query("UPDATE tratamientos SET estado = 'finalizado' WHERE id_tratamiento = 1");
    const r = await ana.get('/api/mascotas/1/pendientes');
    expect(r.body.datos.some((p) => p.tipo === 'tratamiento')).toBe(false);
  });

  test('al aplicar el refuerzo, la dosis vencida deja de aparecer', async () => {
    await pool.query(
      `INSERT INTO vacunas (id_historia, id_veterinario, id_catalogo, nombre, fecha_aplicacion, proxima_dosis)
       SELECT 2, 1, id_catalogo, nombre, CURRENT_DATE, CURRENT_DATE + 365
         FROM catalogo_vacunas WHERE nombre = 'Rabia'`
    );
    const r = await ana.get('/api/mascotas/2/pendientes');
    expect(r.body.vencidos).toBe(0);
    const rabias = r.body.datos.filter((p) => p.titulo === 'Rabia');
    expect(rabias).toHaveLength(1);
    expect(rabias[0]).toMatchObject({ estado: 'proximo', fecha: dia(365) });
  });
});

describe('Porcentaje de vacunas al día', () => {
  test('se calcula con la última dosis de cada vacuna', async () => {
    // Max: Rabia y Pentavalente con la próxima dosis en el futuro -> 2 de 2
    expect((await ana.get('/api/mascotas/1/pendientes')).body.vacunas).toEqual({ total: 2, al_dia: 2, porcentaje: 100 });
  });

  test('una vacuna vencida baja el porcentaje', async () => {
    await pool.query("UPDATE vacunas SET fecha_aplicacion = CURRENT_DATE - 400, proxima_dosis = CURRENT_DATE - 35 WHERE nombre = 'Rabia' AND id_historia = 1");
    const r = await ana.get('/api/mascotas/1/pendientes');
    expect(r.body.vacunas).toEqual({ total: 2, al_dia: 1, porcentaje: 50 });
    expect(r.body.datos[0]).toMatchObject({ tipo: 'vacuna', titulo: 'Rabia', estado: 'vencido' });
  });

  test('una vacuna sin refuerzo cuenta como al día y no es un pendiente', async () => {
    await pool.query("UPDATE vacunas SET fecha_aplicacion = CURRENT_DATE - 10, proxima_dosis = NULL WHERE nombre = 'Rabia' AND id_historia = 1");
    const r = await ana.get('/api/mascotas/1/pendientes');
    expect(r.body.vacunas).toEqual({ total: 2, al_dia: 2, porcentaje: 100 });
    expect(r.body.datos.some((p) => p.titulo === 'Rabia')).toBe(false);
  });
});

describe('Permisos', () => {
  test('el veterinario y el administrador ven los pendientes de cualquier mascota', async () => {
    expect((await vet.get('/api/mascotas/1/pendientes')).status).toBe(200);
    expect((await admin.get('/api/mascotas/3/pendientes')).status).toBe(200);
  });

  test('el propietario no ve los pendientes de una mascota ajena (403)', async () => {
    expect((await ana.get('/api/mascotas/3/pendientes')).status).toBe(403);
    expect((await carlos.get('/api/mascotas/1/pendientes')).status).toBe(403);
  });

  test('mascota inexistente (404), id inválido (400) y sin token (401)', async () => {
    expect((await vet.get('/api/mascotas/9999/pendientes')).status).toBe(404);
    expect((await vet.get('/api/mascotas/abc/pendientes')).status).toBe(400);
    expect((await request(app).get('/api/mascotas/1/pendientes')).status).toBe(401);
  });
});

// Ep3-Hu10: API de citas veterinarias
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

// Fecha futura a una hora exacta (UTC) dentro de "dias" días; cada prueba usa un día distinto
// para que las citas de una prueba no se crucen con las de otra.
const futuro = (dias, hora = 15, minuto = 0) => {
  const f = new Date(Date.now() + dias * 86400000);
  f.setUTCHours(hora, minuto, 0, 0);
  return f.toISOString();
};

let vet, vet2, admin, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com')); // id_veterinario 1
  vet2 = api(await iniciarSesion('vet2@vetcontrol.com')); // id_veterinario 2
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
});
afterAll(() => pool.end());

describe('Crear cita', () => {
  test('el propietario solicita una cita y nace con estado «programada» (la «solicitada» de los criterios)', async () => {
    const r = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(10), motivo: 'Vacuna anual',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      estado: 'programada', id_mascota: 1, id_veterinario: 1, duracion_min: 30, motivo: 'Vacuna anual',
      nombre_mascota: 'Max', nombre_veterinario: 'Laura Quintero', nombre_propietario: 'Ana Torres',
    });
  });

  test('rechaza una fecha u hora pasada', async () => {
    const r = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 1, fecha_hora: new Date(Date.now() - 3600000).toISOString(), motivo: 'X',
    });
    expect(r.status).toBe(400);
    expect(r.body.detalles).toEqual([{ campo: 'fecha_hora', mensaje: 'No se puede agendar una cita en una fecha u hora pasada' }]);
  });

  test('valida los campos obligatorios y el formato de la fecha', async () => {
    const r = await ana.post('/api/citas', { id_veterinario: 1, fecha_hora: 'mañana', motivo: '  ' });
    expect(r.status).toBe(400);
    expect(r.body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['id_mascota', 'fecha_hora', 'motivo']));
  });

  test('responde 409 con un mensaje claro si el veterinario ya tiene una cita a esa hora', async () => {
    const hora = futuro(11);
    expect((await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: hora, motivo: 'A' })).status).toBe(201);
    const r = await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora: hora, motivo: 'B' });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/ya tiene una cita en ese horario/);
  });

  test('también detecta cruces parciales y deja agendar justo al terminar la otra cita', async () => {
    const base = futuro(12, 15, 0); // ocupa 15:00 - 15:30 (UTC)
    expect((await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: base, motivo: 'A' })).status).toBe(201);
    // empieza a mitad de la cita anterior
    expect((await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora: futuro(12, 15, 15), motivo: 'B' })).status).toBe(409);
    // termina cuando empieza la cita anterior
    expect((await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora: futuro(12, 14, 40), duracion_min: 30, motivo: 'C' })).status).toBe(409);
    // empieza exactamente cuando termina la anterior: permitido
    expect((await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora: futuro(12, 15, 30), motivo: 'D' })).status).toBe(201);
  });

  test('otro veterinario puede atender a la misma hora', async () => {
    const hora = futuro(13);
    expect((await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: hora, motivo: 'A' })).status).toBe(201);
    expect((await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 2, fecha_hora: hora, motivo: 'B' })).status).toBe(201);
  });

  test('dos solicitudes simultáneas a la misma hora: solo una se agenda', async () => {
    const hora = futuro(14);
    const [a, b] = await Promise.all([
      ana.post('/api/citas', { id_mascota: 1, id_veterinario: 2, fecha_hora: hora, motivo: 'A' }),
      carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 2, fecha_hora: hora, motivo: 'B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  test('una cita cancelada libera el horario', async () => {
    const hora = futuro(15);
    const cita = await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: hora, motivo: 'A' });
    expect((await ana.put(`/api/citas/${cita.body.id_cita}/estado`, { estado: 'cancelada' })).status).toBe(200);
    expect((await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora: hora, motivo: 'B' })).status).toBe(201);
  });

  test('el propietario no puede agendar para la mascota de otro (403)', async () => {
    const r = await carlos.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(16), motivo: 'X' });
    expect(r.status).toBe(403);
  });

  test('mascota o veterinario inexistente', async () => {
    expect((await ana.post('/api/citas', { id_mascota: 999, id_veterinario: 1, fecha_hora: futuro(16), motivo: 'X' })).status).toBe(404);
    expect((await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 999, fecha_hora: futuro(16), motivo: 'X' })).status).toBe(400);
  });

  test('un veterinario solo agenda en su propia agenda y el administrador en cualquiera', async () => {
    expect((await vet.post('/api/citas', { id_mascota: 1, id_veterinario: 2, fecha_hora: futuro(17), motivo: 'Control' })).status).toBe(403);
    expect((await vet.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(17), motivo: 'Control' })).status).toBe(201);
    expect((await admin.post('/api/citas', { id_mascota: 3, id_veterinario: 2, fecha_hora: futuro(17), motivo: 'Control' })).status).toBe(201);
  });

  test('exige un token JWT válido', async () => {
    expect((await request(app).post('/api/citas').send({})).status).toBe(401);
    expect((await request(app).get('/api/citas').set('Authorization', 'Bearer falso')).status).toBe(401);
  });
});

describe('Listar citas según el rol', () => {
  test('el propietario ve solo las citas de sus mascotas', async () => {
    const r = await ana.get('/api/citas?limite=100');
    expect(r.status).toBe(200);
    expect(r.body.datos.length).toBeGreaterThan(0);
    expect(r.body.datos.every((c) => [1, 2].includes(c.id_mascota))).toBe(true);
    const rc = await carlos.get('/api/citas?limite=100');
    expect(rc.body.datos.every((c) => c.id_mascota === 3)).toBe(true);
  });

  test('el veterinario ve su agenda y no la de otro veterinario', async () => {
    const r1 = await vet.get('/api/citas?limite=100');
    const r2 = await vet2.get('/api/citas?limite=100');
    expect(r1.body.datos.every((c) => c.id_veterinario === 1)).toBe(true);
    expect(r2.body.datos.every((c) => c.id_veterinario === 2)).toBe(true);
    expect(r1.body.meta.total + r2.body.meta.total).toBeGreaterThan(0);
  });

  test('el administrador ve todas las citas', async () => {
    const todas = await admin.get('/api/citas?limite=100');
    const v1 = await vet.get('/api/citas?limite=100');
    const v2 = await vet2.get('/api/citas?limite=100');
    expect(todas.body.meta.total).toBe(v1.body.meta.total + v2.body.meta.total);
  });

  test('filtra por estado, por mascota y por fechas, y valida los filtros', async () => {
    const atendidas = await admin.get('/api/citas?estado=atendida');
    expect(atendidas.body.datos.map((c) => c.id_cita)).toEqual([1]);
    expect((await admin.get('/api/citas?id_mascota=3&estado=programada')).body.datos[0].id_cita).toBe(2);
    const dia = futuro(10).slice(0, 10);
    const delDia = await admin.get(`/api/citas?desde=${dia}&hasta=${dia}`);
    expect(delDia.body.datos).toHaveLength(1);
    expect((await admin.get('/api/citas?estado=inventado')).status).toBe(400);
  });

  test('ordena y pagina', async () => {
    const r = await admin.get('/api/citas?orden=desc&limite=2&pagina=1');
    expect(r.body.datos).toHaveLength(2);
    expect(new Date(r.body.datos[0].fecha_hora) >= new Date(r.body.datos[1].fecha_hora)).toBe(true);
    expect(r.body.meta.limite).toBe(2);
  });
});

describe('Consultar una cita', () => {
  test('cada rol solo ve lo que le corresponde', async () => {
    expect((await ana.get('/api/citas/1')).status).toBe(200);
    expect((await carlos.get('/api/citas/1')).status).toBe(403); // la cita 1 es de Max
    expect((await vet.get('/api/citas/1')).status).toBe(200);
    expect((await vet2.get('/api/citas/1')).status).toBe(403); // es de la agenda de Laura
    expect((await admin.get('/api/citas/1')).status).toBe(200);
    expect((await admin.get('/api/citas/9999')).status).toBe(404);
  });
});

describe('Cambiar el estado de una cita', () => {
  const nueva = async (dias, hora) =>
    (await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(dias, hora), motivo: 'Control' })).body.id_cita;
  // Ep5-Hu6: una cita solicitada primero se confirma; solo la confirmada se completa
  const confirmada = async (dias, hora) => {
    const id = await nueva(dias, hora);
    await vet.put(`/api/citas/${id}/estado`, { estado: 'confirmada' });
    return id;
  };

  test('el veterinario marca la cita como atendida', async () => {
    const id = await confirmada(20, 14);
    const r = await vet.put(`/api/citas/${id}/estado`, { estado: 'atendida', observaciones: 'Sin novedades' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ estado: 'atendida', observaciones: 'Sin novedades' });
  });

  test('también acepta PATCH', async () => {
    const id = await confirmada(26, 14);
    const token = await iniciarSesion('vet@vetcontrol.com');
    const r = await request(app).patch(`/api/citas/${id}/estado`).set('Authorization', `Bearer ${token}`).send({ estado: 'no_asistio' });
    expect(r.body.estado).toBe('no_asistio');
  });

  test('el propietario no puede marcarla como atendida; solo cancelar sus citas', async () => {
    const id = await confirmada(21, 14);
    expect((await ana.put(`/api/citas/${id}/estado`, { estado: 'atendida' })).status).toBe(403);
    expect((await carlos.put(`/api/citas/${id}/estado`, { estado: 'cancelada' })).status).toBe(403); // no es suya
    const r = await ana.put(`/api/citas/${id}/estado`, { estado: 'cancelada', observaciones: 'Viaje' });
    expect(r.body).toMatchObject({ estado: 'cancelada', observaciones: 'Viaje' });
  });

  test('un veterinario no puede cambiar las citas de otro', async () => {
    const id = await nueva(22, 14);
    expect((await vet2.put(`/api/citas/${id}/estado`, { estado: 'atendida' })).status).toBe(403);
  });

  test('el administrador puede cambiar cualquier cita', async () => {
    const id = await confirmada(23, 14);
    expect((await admin.put(`/api/citas/${id}/estado`, { estado: 'no_asistio' })).body.estado).toBe('no_asistio');
  });

  test('una cita que ya no está activa no cambia más (409)', async () => {
    const id = await nueva(24, 14);
    await vet.put(`/api/citas/${id}/estado`, { estado: 'cancelada' });
    const r = await vet.put(`/api/citas/${id}/estado`, { estado: 'atendida' });
    expect(r.status).toBe(409);
    expect(r.body.mensaje).toMatch(/cancelada/);
    // la cita 1 del seed ya estaba atendida
    expect((await admin.put('/api/citas/1/estado', { estado: 'cancelada' })).status).toBe(409);
  });

  test('valida el estado recibido', async () => {
    const id = await nueva(25, 14);
    expect((await vet.put(`/api/citas/${id}/estado`, { estado: 'programada' })).status).toBe(400);
    expect((await vet.put(`/api/citas/${id}/estado`, { estado: 'inventado' })).status).toBe(400);
    expect((await vet.put(`/api/citas/${id}/estado`, {})).status).toBe(400);
    expect((await vet.put('/api/citas/9999/estado', { estado: 'atendida' })).status).toBe(404);
  });

  test('registrar una consulta sobre la cita la deja atendida (Hu8)', async () => {
    const id = await nueva(27, 14);
    const r = await vet.post('/api/historias/1/consultas', { id_cita: id, motivo: 'Control', diagnostico: 'Sano' });
    expect(r.status).toBe(201);
    expect((await vet.get(`/api/citas/${id}`)).body.estado).toBe('atendida');
  });
});
// Ep3-Hu14: lo que necesita la interfaz de citas (confirmar, veterinarios, horarios ocupados)
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

const futuro = (dias, hora = 15, minuto = 0) => {
  const f = new Date(Date.now() + dias * 86400000);
  f.setUTCHours(hora, minuto, 0, 0);
  return f.toISOString();
};
// Día en Colombia (UTC-5) de una fecha ISO
const diaBogota = (iso) => new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);

let vet, vet2, admin, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  vet2 = api(await iniciarSesion('vet2@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  carlos = api(await iniciarSesion('carlos@correo.com'));
});
afterAll(() => pool.end());

const nueva = async (dias, hora) =>
  (await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(dias, hora), motivo: 'Control' })).body;

describe('Confirmar citas', () => {
  test('el veterinario confirma una cita solicitada y luego la marca como completada', async () => {
    const { id_cita } = await nueva(40, 14);
    const confirmada = await vet.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' });
    expect(confirmada.status).toBe(200);
    expect(confirmada.body.estado).toBe('confirmada');
    const atendida = await vet.put(`/api/citas/${id_cita}/estado`, { estado: 'atendida' });
    expect(atendida.body.estado).toBe('atendida');
  });

  test('el propietario no puede confirmar, pero sí cancelar una cita confirmada', async () => {
    const { id_cita } = await nueva(41, 14);
    expect((await ana.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' })).status).toBe(403);
    await vet.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' });
    expect((await ana.put(`/api/citas/${id_cita}/estado`, { estado: 'cancelada' })).body.estado).toBe('cancelada');
  });

  test('otro veterinario no puede confirmar una cita de una agenda ajena y no se confirma dos veces', async () => {
    const { id_cita } = await nueva(42, 14);
    expect((await vet2.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' })).status).toBe(403);
    expect((await admin.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' })).status).toBe(200);
    expect((await vet.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' })).status).toBe(409);
  });

  test('una cita confirmada sigue ocupando el horario', async () => {
    const { id_cita, fecha_hora } = await nueva(43, 14);
    await vet.put(`/api/citas/${id_cita}/estado`, { estado: 'confirmada' });
    const otra = await carlos.post('/api/citas', { id_mascota: 3, id_veterinario: 1, fecha_hora, motivo: 'Otra' });
    expect(otra.status).toBe(409);
    expect(otra.body.mensaje).toMatch(/ocupado/);
  });

  test('se puede filtrar por el estado confirmada', async () => {
    const r = await vet.get('/api/citas?estado=confirmada');
    expect(r.status).toBe(200);
    expect(r.body.datos.every((c) => c.estado === 'confirmada')).toBe(true);
  });
});

describe('Datos para el formulario', () => {
  test('cualquier rol ve los veterinarios activos', async () => {
    const r = await ana.get('/api/citas/veterinarios');
    expect(r.status).toBe(200);
    expect(r.body.map((v) => v.id_veterinario)).toEqual(expect.arrayContaining([1, 2]));

    expect(r.body.some((v) => v.es_yo)).toBe(false);
    const propios = (await vet2.get('/api/citas/veterinarios')).body.filter((v) => v.es_yo);
    expect(propios.map((v) => v.id_veterinario)).toEqual([2]);

    await pool.query("UPDATE usuarios SET activo = false WHERE correo = 'vet2@vetcontrol.com'");
    const sinVet2 = await carlos.get('/api/citas/veterinarios');
    expect(sinVet2.body.find((v) => v.id_veterinario === 2)).toBeUndefined();
    await pool.query("UPDATE usuarios SET activo = true WHERE correo = 'vet2@vetcontrol.com'");
  });

  test('los horarios ocupados muestran solo inicio y fin, sin datos de otras personas', async () => {
    const { fecha_hora } = await nueva(44, 15);
    const r = await carlos.get(`/api/citas/ocupados?id_veterinario=1&fecha=${diaBogota(fecha_hora)}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(Object.keys(r.body[0]).sort()).toEqual(['fin', 'inicio']);
    expect(new Date(r.body[0].fin) - new Date(r.body[0].inicio)).toBe(30 * 60000);
  });

  test('una cita cancelada libera el horario', async () => {
    const { id_cita, fecha_hora } = await nueva(45, 15);
    await ana.put(`/api/citas/${id_cita}/estado`, { estado: 'cancelada' });
    const r = await ana.get(`/api/citas/ocupados?id_veterinario=1&fecha=${diaBogota(fecha_hora)}`);
    expect(r.body).toHaveLength(0);
  });

  test('valida los parámetros de los horarios ocupados', async () => {
    expect((await ana.get('/api/citas/ocupados?fecha=2026-12-01')).status).toBe(400);
    expect((await ana.get('/api/citas/ocupados?id_veterinario=1&fecha=mañana')).status).toBe(400);
  });
});

describe('Tipo de consulta y citas agendadas por el personal', () => {
  test('la cita guarda el tipo de consulta (por defecto «consulta_general»)', async () => {
    const conTipo = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(50, 14), motivo: 'Refuerzo', tipo_consulta: 'vacunacion',
    });
    expect(conTipo.status).toBe(201);
    expect(conTipo.body.tipo_consulta).toBe('vacunacion');
    const sinTipo = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(50, 16), motivo: 'Revisión',
    });
    expect(sinTipo.body.tipo_consulta).toBe('consulta_general');
  });

  test('un tipo de consulta inválido responde 400', async () => {
    const r = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(51, 14), motivo: 'X', tipo_consulta: 'peluqueria',
    });
    expect(r.status).toBe(400);
    expect(r.body.detalles[0].campo).toBe('tipo_consulta');
  });

  test('el veterinario agenda en su propia agenda y la cita nace confirmada', async () => {
    const r = await vet.post('/api/citas', {
      id_mascota: 3, id_veterinario: 1, fecha_hora: futuro(52, 14), motivo: 'Control', tipo_consulta: 'control',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'confirmada', tipo_consulta: 'control', id_veterinario: 1 });
  });

  test('el veterinario no puede agendar en la agenda de otro veterinario', async () => {
    const r = await vet.post('/api/citas', {
      id_mascota: 3, id_veterinario: 2, fecha_hora: futuro(52, 16), motivo: 'Control',
    });
    expect(r.status).toBe(403);
  });

  test('el administrador agenda para cualquier veterinario y la cita nace confirmada; la del propietario, solicitada', async () => {
    const r = await admin.post('/api/citas', {
      id_mascota: 3, id_veterinario: 2, fecha_hora: futuro(53, 14), motivo: 'Cirugía programada', tipo_consulta: 'cirugia',
    });
    expect(r.body.estado).toBe('confirmada');
    const deAna = await ana.post('/api/citas', {
      id_mascota: 1, id_veterinario: 2, fecha_hora: futuro(53, 16), motivo: 'Consulta',
    });
    expect(deAna.body.estado).toBe('programada');
  });
});
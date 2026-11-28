// La duración de una cita depende del tipo de consulta; el propietario no la elige
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

const futuro = (dias, hora = 15, minuto = 0) => {
  const f = new Date(Date.now() + dias * 86400000);
  f.setUTCHours(hora, minuto, 0, 0);
  return f.toISOString();
};

let vet, admin, ana;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com')); // id_veterinario 1
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1)
});
afterAll(() => pool.end());

const pedir = (cliente, datos, dia) =>
  cliente.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(dia), motivo: 'Prueba', ...datos });

describe('Duración según el tipo de consulta', () => {
  test.each([
    ['consulta_general', 30],
    ['vacunacion', 15],
    ['control', 30],
    ['desparasitacion', 15],
    ['cirugia', 60],
    ['urgencia', 30],
    ['otro', 30],
  ])('una cita de %s del propietario dura %i minutos', async (tipo, minutos) => {
    const dia = 20 + ['consulta_general', 'vacunacion', 'control', 'desparasitacion', 'cirugia', 'urgencia', 'otro'].indexOf(tipo);
    const r = await pedir(ana, { tipo_consulta: tipo }, dia);
    expect(r.status).toBe(201);
    expect(r.body.duracion_min).toBe(minutos);
  });

  test('sin tipo de consulta se usa «consulta general» (30 minutos)', async () => {
    const r = await pedir(ana, {}, 30);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ tipo_consulta: 'consulta_general', duracion_min: 30 });
  });

  test('si el propietario envía otra duración, se ignora', async () => {
    const r = await pedir(ana, { tipo_consulta: 'vacunacion', duracion_min: 240 }, 31);
    expect(r.status).toBe(201);
    expect(r.body.duracion_min).toBe(15);
  });

  test('el veterinario puede ajustar la duración al agendar', async () => {
    const r = await pedir(vet, { tipo_consulta: 'cirugia', duracion_min: 120 }, 32);
    expect(r.status).toBe(201);
    expect(r.body.duracion_min).toBe(120);
  });

  test('el administrador también; sin duración usa la del tipo', async () => {
    expect((await pedir(admin, { tipo_consulta: 'control', duracion_min: 45 }, 33)).body.duracion_min).toBe(45);
    expect((await pedir(admin, { tipo_consulta: 'vacunacion' }, 34)).body.duracion_min).toBe(15);
  });

  test('una duración inválida sigue rechazándose (400)', async () => {
    expect((await pedir(vet, { duracion_min: 5 }, 35)).status).toBe(400);
    expect((await pedir(vet, { duracion_min: 500 }, 35)).status).toBe(400);
  });

  test('la duración del tipo es la que se usa para detectar cruces de horario', async () => {
    // Vacunación: 15 min (15:00 a 15:15). Otra cita a las 15:15 cabe; una a las 15:10 se cruza.
    expect((await pedir(ana, { tipo_consulta: 'vacunacion' }, 40)).status).toBe(201);
    const cruce = await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(40, 15, 10), motivo: 'X' });
    expect(cruce.status).toBe(409);
    const justo = await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(40, 15, 15), motivo: 'Y' });
    expect(justo.status).toBe(201);
  });
});

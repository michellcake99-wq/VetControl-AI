// Ep5-Hu2: recordatorio 7 días antes de la próxima dosis de una vacuna
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

const dia = (dias) => new Date(Date.now() + dias * 86400000 - 5 * 3600000).toISOString().slice(0, 10);

let vet, ana, catalogo;
const idCatalogo = (n) => catalogo.find((c) => c.nombre === n).id_catalogo;
const recordatorios = async (idVacuna) =>
  (await pool.query("SELECT * FROM recordatorios WHERE tipo = 'vacuna' AND id_referencia = $1 ORDER BY id_recordatorio", [idVacuna])).rows;
// Historia 2 = Luna (felina) de Ana
const registrar = (nombre, aplicacion, proxima) =>
  vet.post('/api/historias/2/vacunas', { id_catalogo: idCatalogo(nombre), fecha_aplicacion: aplicacion, ...(proxima && { proxima_dosis: proxima }) });

beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  catalogo = (await vet.get('/api/vacunas/catalogo')).body;
});
afterAll(() => pool.end());
beforeEach(() => pool.query('TRUNCATE recordatorios; DELETE FROM vacunas'));

test('al registrar una próxima dosis se programa el recordatorio 7 días antes', async () => {
  const v = (await registrar('Leucemia felina', dia(-1), dia(30))).body;
  const [r, ...otros] = await recordatorios(v.id_vacuna);
  expect(otros).toHaveLength(0);
  expect(r.id_usuario).toBe(4);
  expect(r.estado).toBe('pendiente');
  expect(r.mensaje).toContain('Luna');
  expect(r.mensaje).toContain('Leucemia felina');
  // 8:00 a. m. de Colombia = 13:00 UTC, siete días antes de la dosis
  expect(r.fecha_programada.toISOString()).toBe(`${dia(23)}T13:00:00.000Z`);
});

test('sin próxima dosis no hay recordatorio', async () => {
  const v = (await registrar('Rabia', dia(-1))).body;
  expect(await recordatorios(v.id_vacuna)).toHaveLength(0);
});

test('si la fecha cambia se actualiza el recordatorio (sin duplicar) y si se quita se cancela', async () => {
  const v = (await registrar('Triple felina', dia(-1), dia(40))).body;
  await vet.put(`/api/vacunas/${v.id_vacuna}`, { proxima_dosis: dia(60) });
  expect((await recordatorios(v.id_vacuna)).map((r) => r.estado)).toEqual(['cancelado', 'pendiente']);
  await vet.put(`/api/vacunas/${v.id_vacuna}`, { proxima_dosis: dia(60) });
  expect(await recordatorios(v.id_vacuna)).toHaveLength(2);
  await vet.put(`/api/vacunas/${v.id_vacuna}`, { proxima_dosis: null });
  expect((await recordatorios(v.id_vacuna)).map((r) => r.estado)).toEqual(['cancelado', 'cancelado']);
});

test('si la dosis ya se aplicó (nuevo registro de la misma vacuna) no se recuerda más', async () => {
  const antes = (await registrar('Triple felina', dia(-30), dia(20))).body;
  expect((await recordatorios(antes.id_vacuna))[0].estado).toBe('pendiente');
  await registrar('Triple felina', dia(-2), dia(363));
  expect((await recordatorios(antes.id_vacuna))[0].estado).toBe('cancelado');
});

test('si faltan menos de 7 días el aviso sale de inmediato y una fecha pasada no genera recordatorio', async () => {
  const cerca = (await registrar('Rabia', dia(-3), dia(3))).body;
  const [r] = await recordatorios(cerca.id_vacuna);
  expect(r.fecha_programada.getTime()).toBeLessThanOrEqual(Date.now());
  const vieja = (await registrar('Leucemia felina', dia(-100), dia(-10))).body;
  expect(await recordatorios(vieja.id_vacuna)).toHaveLength(0);
});

test('el propietario ve el recordatorio en su campana cuando llega la hora', async () => {
  const v = (await registrar('Triple felina', dia(-1), dia(5))).body;
  const lista = (await ana.get('/api/notificaciones')).body.datos;
  const n = lista.find((x) => x.tipo === 'vacuna' && x.id_referencia === v.id_vacuna);
  expect(n.titulo).toBe('Recordatorio de vacuna');
  expect(n.enlace).toBe('/vacunas');
});

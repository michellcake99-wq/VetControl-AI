// Ep5-Hu3: recordatorios de tratamientos activos según su frecuencia
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { horasEntreDosis } = require('../utils/frecuencia');
const { generarRecordatoriosTratamientos, procesarPendientes } = require('../utils/notificaciones');

describe('Interpretación de la frecuencia', () => {
  test.each([
    ['cada 8 horas', 8],
    ['Cada 12 horas', 12],
    ['cada 24 horas', 24],
    ['cada 2 días', 48],
    ['3 veces al día', 8],
    ['dos veces al día', 12],
    ['una vez al día', 24],
    ['diaria', 24],
    ['cada semana', 168],
    ['semanal', 168],
  ])('«%s» -> %s h', (texto, horas) => expect(horasEntreDosis(texto)).toBe(horas));

  test('lo que no se entiende devuelve null', () => {
    expect(horasEntreDosis('cuando duela')).toBeNull();
    expect(horasEntreDosis('')).toBeNull();
    expect(horasEntreDosis('cada 0 horas')).toBeNull();
  });
});

const hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const diaMas = (n) => new Date(Date.now() - 5 * 3600000 + n * 86400000).toISOString().slice(0, 10);

let vet, ana, idConsulta;
const recordatorios = async (id) =>
  (await pool.query("SELECT * FROM recordatorios WHERE tipo = 'tratamiento' AND id_referencia = $1 ORDER BY fecha_programada", [id])).rows;
// Se «retrasa» la fecha de registro para que cuenten las dosis de hoy aunque el tratamiento se haya creado ahora
const crear = async (datos) => {
  const r = await vet.post(`/api/consultas/${idConsulta}/tratamientos`, { medicamento: 'Amoxicilina', dosis: '250 mg', frecuencia: 'cada 8 horas', ...datos });
  await pool.query("UPDATE tratamientos SET fecha_registro = now() - interval '3 days' WHERE id_tratamiento = $1", [r.body.id_tratamiento]);
  return r.body;
};

beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  idConsulta = (await pool.query('SELECT id_consulta FROM consultas c JOIN historias_clinicas h USING (id_historia) JOIN mascotas m USING (id_mascota) WHERE m.id_propietario = 1 LIMIT 1')).rows[0].id_consulta;
});
afterAll(() => pool.end());
beforeEach(() => pool.query('TRUNCATE recordatorios, evoluciones_tratamiento; DELETE FROM tratamientos'));

test('un tratamiento activo genera el recordatorio de la dosis que toca, con mascota, medicamento y dosis', async () => {
  const t = await crear({ fecha_inicio: diaMas(-1) });
  // Hoy a las 13:00 (hora de Colombia) le tocó la dosis de las 08:00 y la de las 16:00 aún no
  const ahora = new Date(`${hoy()}T13:00:00-05:00`);
  expect((await generarRecordatoriosTratamientos(ahora)).creados).toBe(1);
  const [r] = await recordatorios(t.id_tratamiento);
  expect(r.fecha_programada.toISOString()).toBe(`${hoy()}T13:00:00.000Z`);
  expect(r.mensaje).toMatch(/Amoxicilina, 250 mg \(cada 8 horas\)/);
  expect(r.id_usuario).toBe(4);
  expect(r.titulo).toBe('Recordatorio de tratamiento');
});

test('no repite la misma dosis y genera la siguiente cuando llega su hora', async () => {
  const t = await crear({ fecha_inicio: diaMas(-1) });
  const a = new Date(`${hoy()}T13:30:00-05:00`);
  await generarRecordatoriosTratamientos(a);
  expect((await generarRecordatoriosTratamientos(a)).creados).toBe(0);
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T16:05:00-05:00`));
  expect(await recordatorios(t.id_tratamiento)).toHaveLength(2);
});

test('la frecuencia diaria genera un recordatorio al día', async () => {
  const t = await crear({ fecha_inicio: diaMas(-1), frecuencia: 'una vez al día' });
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T09:00:00-05:00`));
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T20:00:00-05:00`));
  expect(await recordatorios(t.id_tratamiento)).toHaveLength(1);
});

test('no genera recordatorios si el tratamiento terminó, está suspendido o aún no empieza', async () => {
  const vencido = await crear({ fecha_inicio: diaMas(-10), fecha_fin: diaMas(-2) });
  const futuro = await crear({ fecha_inicio: diaMas(5) });
  const susp = await crear({ fecha_inicio: diaMas(-1) });
  await vet.put(`/api/tratamientos/${susp.id_tratamiento}`, { estado: 'suspendido' });
  const fin = await crear({ fecha_inicio: diaMas(-1) });
  await vet.put(`/api/tratamientos/${fin.id_tratamiento}`, { estado: 'finalizado' });
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T13:00:00-05:00`));
  for (const t of [vencido, futuro, susp, fin]) expect(await recordatorios(t.id_tratamiento)).toHaveLength(0);
});

test('al suspender o finalizar se cancelan los recordatorios que aún no se enviaron', async () => {
  const t = await crear({ fecha_inicio: diaMas(-1) });
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T13:00:00-05:00`));
  await vet.put(`/api/tratamientos/${t.id_tratamiento}`, { estado: 'suspendido' });
  expect((await recordatorios(t.id_tratamiento))[0].estado).toBe('cancelado');
});

test('el último día (fecha_fin) sí se recuerda y la dosis anterior a recetarlo no', async () => {
  const t = await crear({ fecha_inicio: diaMas(-3), fecha_fin: hoy() });
  await generarRecordatoriosTratamientos(new Date(`${hoy()}T13:00:00-05:00`));
  expect(await recordatorios(t.id_tratamiento)).toHaveLength(1);
  await pool.query('TRUNCATE recordatorios');
  await pool.query("UPDATE tratamientos SET fecha_registro = now() + interval '1 day' WHERE id_tratamiento = $1", [t.id_tratamiento]);
  await generarRecordatoriosTratamientos(new Date());
  expect(await recordatorios(t.id_tratamiento)).toHaveLength(0);
});

test('llega a la campana del propietario y se envía por correo una sola vez', async () => {
  const t = await crear({ fecha_inicio: diaMas(-1), frecuencia: 'cada 6 horas' });
  await generarRecordatoriosTratamientos();
  const lista = (await ana.get('/api/notificaciones')).body.datos;
  expect(lista.some((n) => n.tipo === 'tratamiento' && n.id_referencia === t.id_tratamiento)).toBe(true);
  process.env.BREVO_API_KEY = 'x';
  process.env.CORREO_REMITENTE = 'c@e.com';
  const f = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 201 });
  await procesarPendientes();
  await procesarPendientes();
  expect(f).toHaveBeenCalledTimes(1);
  expect(JSON.parse(f.mock.calls[0][1].body).subject).toBe('Recordatorio de tratamiento');
  delete process.env.BREVO_API_KEY;
  delete process.env.CORREO_REMITENTE;
  f.mockRestore();
});

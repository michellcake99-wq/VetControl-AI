// Ep5-Hu1: recordatorios de citas y notificaciones (campana + correo)
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { procesarPendientes } = require('../utils/notificaciones');

const futuro = (dias, hora = 15) => {
  const f = new Date(Date.now() + dias * 86400000);
  f.setUTCHours(hora, 0, 0, 0);
  return f.toISOString();
};

let vet, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  carlos = api(await iniciarSesion('carlos@correo.com'));
});
afterAll(() => pool.end());

const recordatorios = async (idCita) =>
  (await pool.query("SELECT * FROM recordatorios WHERE tipo = 'cita' AND id_referencia = $1 ORDER BY id_recordatorio", [idCita])).rows;
const solicitar = async (dias, hora) =>
  (await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(dias, hora), motivo: 'Control' })).body;

describe('Recordatorio de cita', () => {
  test('al confirmar se programa 24 h antes y no se duplica', async () => {
    const cita = await solicitar(50, 14);
    expect(await recordatorios(cita.id_cita)).toHaveLength(0);
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    const [r, ...otros] = await recordatorios(cita.id_cita);
    expect(otros).toHaveLength(0);
    expect(new Date(r.fecha_programada).getTime()).toBe(new Date(cita.fecha_hora).getTime() - 24 * 3600000);
    expect(r.estado).toBe('pendiente');
    // Una cita agendada por el veterinario ya nace confirmada y también programa el recordatorio
    const directa = await vet.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(51, 14), motivo: 'Vacuna' });
    expect(await recordatorios(directa.body.id_cita)).toHaveLength(1);
  });

  test('al cancelar la cita se retira el recordatorio pendiente', async () => {
    const cita = await solicitar(52, 14);
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    await ana.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'cancelada' });
    expect((await recordatorios(cita.id_cita))[0].estado).toBe('cancelado');
  });

  test('si la fecha cambia, el recordatorio viejo se cancela y se crea el nuevo', async () => {
    const cita = await solicitar(53, 14);
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    await pool.query("UPDATE citas SET fecha_hora = fecha_hora + interval '2 days' WHERE id_cita = $1", [cita.id_cita]);
    await require('../utils/notificaciones').sincronizarRecordatorioCita(cita.id_cita);
    const filas = await recordatorios(cita.id_cita);
    expect(filas.map((f) => f.estado)).toEqual(['cancelado', 'pendiente']);
    // Sincronizar otra vez no crea un tercero
    await require('../utils/notificaciones').sincronizarRecordatorioCita(cita.id_cita);
    expect(await recordatorios(cita.id_cita)).toHaveLength(2);
  });

  test('si la cita es en menos de 24 h el recordatorio sale de inmediato', async () => {
    const f = new Date(Date.now() + 3 * 3600000).toISOString();
    const cita = (await vet.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: f, motivo: 'Urgente' })).body;
    const [r] = await recordatorios(cita.id_cita);
    expect(new Date(r.fecha_programada).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('Campana de notificaciones', () => {
  test('el veterinario recibe un aviso cuando un propietario solicita una cita', async () => {
    const cita = await solicitar(54, 14);
    const lista = await vet.get('/api/notificaciones');
    const aviso = lista.body.datos.find((n) => n.id_referencia === cita.id_cita && n.tipo === 'aviso');
    expect(aviso.titulo).toBe('Nueva cita solicitada');
    expect(aviso.leido).toBe(false);
    // El propietario no ve los avisos del veterinario
    expect((await carlos.get('/api/notificaciones')).body.datos.some((n) => n.id_referencia === cita.id_cita)).toBe(false);
  });

  test('el recordatorio solo aparece cuando llega su hora', async () => {
    const cita = await solicitar(65, 14);
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    const ver = async () => (await ana.get('/api/notificaciones')).body.datos.some((n) => n.tipo === 'cita' && n.id_referencia === cita.id_cita);
    expect(await ver()).toBe(false);
    await pool.query("UPDATE recordatorios SET fecha_programada = now() WHERE tipo = 'cita' AND id_referencia = $1", [cita.id_cita]);

    expect(await ver()).toBe(true);
    // Si se cancela la cita, desaparece
    await ana.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'cancelada' });
    expect(await ver()).toBe(false);
  });

  test('contador, marcar una como leída y marcar todas', async () => {
    await solicitar(66, 14);
    await solicitar(67, 14);
    const antes = (await vet.get('/api/notificaciones/no-leidas')).body.no_leidas;
    expect(antes).toBeGreaterThanOrEqual(2);
    const primera = (await vet.get('/api/notificaciones?solo_no_leidas=true')).body.datos[0];
    expect((await vet.get('/api/notificaciones')).body.datos[0].fecha).toBeDefined();
    expect((await vet.patch(`/api/notificaciones/${primera.id_notificacion}/leida`)).status).toBe(200);
    expect((await vet.get('/api/notificaciones/no-leidas')).body.no_leidas).toBe(antes - 1);
  });

  test('nadie puede marcar las notificaciones de otro', async () => {
    const mia = (await vet.get('/api/notificaciones')).body.datos[0];
    expect((await carlos.patch(`/api/notificaciones/${mia.id_notificacion}/leida`)).status).toBe(404);
    expect((await api(null).get('/api/notificaciones')).status).toBe(401);
  });

  test('marcar todas como leídas deja el contador en cero', async () => {
    await vet.post('/api/notificaciones/marcar-leidas', {});
    expect((await vet.get('/api/notificaciones/no-leidas')).body.no_leidas).toBe(0);
  });
});

describe('Envío por correo', () => {
  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.CORREO_REMITENTE;
    jest.restoreAllMocks();
  });

  test('sin llave de correo los recordatorios se procesan sin enviar', async () => {
    await pool.query("UPDATE recordatorios SET fecha_programada = now() WHERE estado = 'pendiente'");
    const r = await procesarPendientes();
    expect(r.procesados).toBeGreaterThan(0);
    expect(r.correos).toBe(0);
  });

  test('con llave se envía un correo una sola vez por recordatorio', async () => {
    process.env.BREVO_API_KEY = 'llave-de-prueba';
    process.env.CORREO_REMITENTE = 'clinica@ejemplo.com';
    const llamadas = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
      llamadas.push({ url, cuerpo: JSON.parse(opts.body), llave: opts.headers['api-key'] });
      return { ok: true, status: 201 };
    });
    const cita = await solicitar(58, 14);
    await pool.query("UPDATE recordatorios SET estado = 'enviado' WHERE estado = 'pendiente'");
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    await pool.query("UPDATE recordatorios SET estado = 'enviado' WHERE tipo = 'aviso'"); // el aviso de «cita confirmada» no es lo que se prueba aquí
    await pool.query("UPDATE recordatorios SET fecha_programada = now() WHERE tipo = 'cita' AND id_referencia = $1", [cita.id_cita]);
    const primera = await procesarPendientes();
    const segunda = await procesarPendientes();
    expect(primera.correos).toBe(1);
    expect(segunda.procesados).toBe(0);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(llamadas[0].cuerpo.to[0].email).toBe('ana@correo.com');
    expect(llamadas[0].cuerpo.subject).toBe('Recordatorio de cita');
    const [r] = await recordatorios(cita.id_cita);
    expect(r.estado).toBe('enviado');
    expect(r.fecha_envio).not.toBeNull();
  });

  test('si el servicio de correo falla el recordatorio queda como fallido', async () => {
    process.env.BREVO_API_KEY = 'x';
    process.env.CORREO_REMITENTE = 'clinica@ejemplo.com';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 });
    const cita = await solicitar(59, 14);
    await pool.query("UPDATE recordatorios SET estado = 'enviado' WHERE estado = 'pendiente'");
    await vet.put(`/api/citas/${cita.id_cita}/estado`, { estado: 'confirmada' });
    await pool.query("UPDATE recordatorios SET fecha_programada = now() WHERE tipo = 'cita' AND id_referencia = $1", [cita.id_cita]);
    await procesarPendientes();
    expect((await recordatorios(cita.id_cita))[0].estado).toBe('fallido');
  });
});
// Ep5-Hu6: el veterinario cambia el estado de la cita (transiciones válidas) y el propietario recibe el aviso
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

const futuro = (dias, hora = 15) => {
  const f = new Date(Date.now() + dias * 86400000);
  f.setUTCHours(hora, 0, 0, 0);
  return f.toISOString();
};

let vet, ana, admin;
beforeAll(async () => {
  await reiniciarBase();
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
});
afterAll(() => pool.end());

let dia = 100;
const nueva = async () =>
  (await ana.post('/api/citas', { id_mascota: 1, id_veterinario: 1, fecha_hora: futuro(dia++, 14), motivo: 'Control' })).body.id_cita;
const cambiar = (id, estado, quien = vet) => quien.put(`/api/citas/${id}/estado`, { estado });
const avisos = async (usuario, id) =>
  (await usuario.get('/api/notificaciones')).body.datos.filter((n) => n.tipo === 'aviso' && n.id_referencia === id).map((n) => n.titulo);

describe('Transiciones válidas', () => {
  test('solicitada solo pasa a confirmada o cancelada', async () => {
    const id = await nueva();
    for (const estado of ['atendida', 'no_asistio']) {
      const r = await cambiar(id, estado);
      expect(r.status).toBe(409);
      expect(r.body.mensaje).toMatch(/No se puede pasar una cita de «programada»/);
    }
    expect((await cambiar(id, 'confirmada')).body.estado).toBe('confirmada');
    const otra = await nueva();
    expect((await cambiar(otra, 'cancelada')).body.estado).toBe('cancelada');
  });

  test('confirmada pasa a completada o cancelada y no vuelve atrás', async () => {
    const id = await nueva();
    await cambiar(id, 'confirmada');
    expect((await cambiar(id, 'confirmada')).status).toBe(409);
    expect((await cambiar(id, 'atendida')).body.estado).toBe('atendida');
    const otra = await nueva();
    await cambiar(otra, 'confirmada');
    expect((await cambiar(otra, 'cancelada')).body.estado).toBe('cancelada');
  });

  test('completada y cancelada son estados finales', async () => {
    const completada = await nueva();
    await cambiar(completada, 'confirmada');
    await cambiar(completada, 'atendida');
    const cancelada = await nueva();
    await cambiar(cancelada, 'cancelada');
    for (const id of [completada, cancelada]) {
      for (const estado of ['confirmada', 'atendida', 'cancelada']) {
        expect((await cambiar(id, estado, admin)).status).toBe(409);
      }
    }
  });
});

describe('Aviso al propietario', () => {
  test('recibe un aviso cuando el veterinario confirma, completa o cancela su cita', async () => {
    const id = await nueva();
    await cambiar(id, 'confirmada');
    expect(await avisos(ana, id)).toEqual(['Cita confirmada']);
    await cambiar(id, 'atendida');
    expect(await avisos(ana, id)).toEqual(['Cita completada', 'Cita confirmada']);
    const otra = await nueva();
    await cambiar(otra, 'cancelada');
    expect(await avisos(ana, otra)).toEqual(['Cita cancelada']);
  });

  test('si el propietario cancela, el aviso es para el veterinario y no para él mismo', async () => {
    const id = await nueva();
    await ana.put(`/api/citas/${id}/estado`, { estado: 'cancelada' });
    expect(await avisos(ana, id)).toEqual([]);
    expect(await avisos(vet, id)).toEqual(['Cita cancelada', 'Nueva cita solicitada']);
  });

  test('una transición no válida no genera aviso', async () => {
    const id = await nueva();
    await cambiar(id, 'atendida');
    expect(await avisos(ana, id)).toEqual([]);
  });

  test('registrar la consulta de la cita la completa y también avisa al propietario', async () => {
    const id = await nueva();
    await cambiar(id, 'confirmada');
    await vet.post('/api/historias/1/consultas', { id_cita: id, motivo: 'Control', diagnostico: 'Sano' });
    expect(await avisos(ana, id)).toContain('Cita completada');
  });
});

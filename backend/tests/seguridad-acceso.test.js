// Ep7-Hu2: un propietario no puede consultar ni modificar datos de mascotas ajenas (403)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, carlos, vet, admin;
let ids; // recursos que pertenecen a Ana (dueña de Max, mascota 1)
const fetchOriginal = global.fetch;

const uno = async (sql, params) => (await pool.query(sql, params)).rows[0];

beforeAll(async () => {
  await reiniciarBase();
  process.env.IA_API_KEY = process.env.IA_API_KEY || 'clave-de-prueba';
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ model: 'modelo-prueba', choices: [{ message: { content: 'Respuesta de prueba' } }] }),
  }));
  ana = api(await iniciarSesion('ana@correo.com')); // dueña de Max (1) y Luna (2)
  carlos = api(await iniciarSesion('carlos@correo.com')); // dueño de Rocky (3)
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));

  const propietario = (await uno('SELECT id_propietario FROM mascotas WHERE id_mascota = 1')).id_propietario;
  ids = {
    propietario,
    historia: (await uno('SELECT id_historia FROM historias_clinicas WHERE id_mascota = 1')).id_historia,
    consulta: (await uno(
      `SELECT c.id_consulta FROM consultas c JOIN historias_clinicas h USING (id_historia)
        WHERE h.id_mascota = 1 ORDER BY c.id_consulta LIMIT 1`
    )).id_consulta,
    tratamiento: (await uno(
      `SELECT t.id_tratamiento FROM tratamientos t JOIN consultas c USING (id_consulta)
         JOIN historias_clinicas h USING (id_historia) WHERE h.id_mascota = 1 ORDER BY t.id_tratamiento LIMIT 1`
    )).id_tratamiento,
    cita: (await uno('SELECT id_cita FROM citas WHERE id_mascota = 1 ORDER BY id_cita LIMIT 1')).id_cita,
    conversacion: (await uno(
      `INSERT INTO conversaciones (id_propietario, id_veterinario, id_mascota) VALUES ($1, 1, 1)
       ON CONFLICT (id_propietario, id_veterinario, id_mascota) DO UPDATE SET id_mascota = EXCLUDED.id_mascota
       RETURNING id_conversacion`,
      [propietario]
    )).id_conversacion,
  };
});
afterAll(() => {
  global.fetch = fetchOriginal;
  return pool.end();
});

// Rutas que usan datos de Ana. Para otro propietario todas deben responder 403.
// Los ":nombre" se reemplazan por los ids reales dentro de cada prueba (los ids se cargan en beforeAll).
const RUTAS_AJENAS = [
  ['get', '/api/mascotas/1'],
  ['put', '/api/mascotas/1', { nombre: 'Hackeada' }],
  ['get', '/api/mascotas/1/historia'],
  ['get', '/api/mascotas/1/consultas'],
  ['get', '/api/mascotas/1/tratamientos'],
  ['get', '/api/mascotas/1/historial'],
  ['get', '/api/historias/:historia'],
  ['get', '/api/historias/:historia/consultas'],
  ['get', '/api/historias/:historia/tratamientos'],
  ['get', '/api/historias/:historia/vacunas'],
  ['get', '/api/consultas/:consulta'],
  ['get', '/api/tratamientos/:tratamiento/evoluciones'],
  ['post', '/api/tratamientos/:tratamiento/evoluciones', { estado_general: 3, dosis_aplicada: true, descripcion: 'Intento de un usuario ajeno' }],
  ['get', '/api/propietarios/:propietario'],
  ['put', '/api/propietarios/:propietario', { direccion: 'Calle falsa 123' }],
  ['get', '/api/propietarios/:propietario/mascotas'],
  ['get', '/api/citas/:cita'],
  ['put', '/api/citas/:cita/estado', { estado: 'cancelada' }],
  ['get', '/api/conversaciones/:conversacion/mensajes'],
  ['post', '/api/ia/consultar', { pregunta: '¿Cómo está su salud?', id_mascota: 1 }],
  ['post', '/api/ia/resumir-historial', { id_mascota: 1 }],
];
const conIds = (url) => url.replace(/:(\w+)/g, (_, clave) => ids[clave]);

describe('Un propietario no accede a los datos de mascotas ajenas', () => {
  test.each(RUTAS_AJENAS.map(([metodo, url, cuerpo]) => [`${metodo.toUpperCase()} ${url}`, metodo, url, cuerpo]))(
    '%s → 403',
    async (_nombre, metodo, url, cuerpo) => {
      const r = await carlos[metodo](conIds(url), cuerpo);
      expect(r.status).toBe(403);
    }
  );

  test('los intentos no cambiaron nada y no se enviaron datos al servicio de IA', async () => {
    expect((await uno('SELECT nombre FROM mascotas WHERE id_mascota = 1')).nombre).toBe('Max');
    expect((await uno('SELECT direccion FROM propietarios WHERE id_propietario = $1', [ids.propietario])).direccion)
      .not.toBe('Calle falsa 123');
    expect((await uno('SELECT estado FROM citas WHERE id_cita = $1', [ids.cita])).estado).not.toBe('cancelada');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sin iniciar sesión se responde 401', async () => {
    for (const url of ['/api/mascotas/1', '/api/mascotas/1/historia', `/api/historias/${ids.historia}`]) {
      expect((await request(app).get(url)).status).toBe(401);
    }
  });
});

describe('Los listados solo traen lo propio', () => {
  test('GET /api/mascotas: Carlos solo ve a Rocky y Ana solo a sus mascotas', async () => {
    const deCarlos = (await carlos.get('/api/mascotas?limite=100')).body.datos.map((m) => m.id_mascota);
    expect(deCarlos).toEqual([3]);
    const deAna = (await ana.get('/api/mascotas?limite=100')).body.datos.map((m) => m.id_mascota).sort();
    expect(deAna).toEqual([1, 2]);
  });

  test('GET /api/citas y /api/consultas: solo las de sus mascotas', async () => {
    const citas = Number((await uno(
      `SELECT count(*) AS n FROM citas c JOIN mascotas m USING (id_mascota)
        WHERE m.id_propietario = (SELECT id_propietario FROM mascotas WHERE id_mascota = 3)`
    )).n);
    expect((await carlos.get('/api/citas?limite=100')).body.datos).toHaveLength(citas);

    const consultas = Number((await uno(
      `SELECT count(*) AS n FROM consultas c JOIN historias_clinicas h USING (id_historia)
         JOIN mascotas m USING (id_mascota)
        WHERE m.id_propietario = (SELECT id_propietario FROM mascotas WHERE id_mascota = 3)`
    )).n);
    expect((await carlos.get('/api/consultas?limite=100')).body.datos).toHaveLength(consultas);
  });

  test('un propietario no entra a los listados de propietarios ni de veterinarios (403)', async () => {
    expect((await carlos.get('/api/propietarios')).status).toBe(403);
    expect((await carlos.get('/api/veterinarios')).status).toBe(403);
  });
});

describe('Quien sí está autorizado accede', () => {
  test('la dueña ve los datos de su mascota (200)', async () => {
    for (const url of ['/api/mascotas/1', '/api/mascotas/1/historia', '/api/mascotas/1/historial',
      `/api/historias/${ids.historia}`, `/api/consultas/${ids.consulta}`, `/api/tratamientos/${ids.tratamiento}/evoluciones`,
      `/api/propietarios/${ids.propietario}`, `/api/citas/${ids.cita}`, `/api/conversaciones/${ids.conversacion}/mensajes`]) {
      expect((await ana.get(url)).status).toBe(200);
    }
  });

  test('el veterinario y el administrador ven la información de cualquier mascota (200)', async () => {
    for (const usuario of [vet, admin]) {
      for (const url of ['/api/mascotas/1', '/api/mascotas/3', '/api/mascotas/1/historial', `/api/historias/${ids.historia}`]) {
        expect((await usuario.get(url)).status).toBe(200);
      }
    }
  });
});
// Ep7-Hu2: contraseñas cifradas y nunca devueltas; consultas con parámetros (sin inyección SQL)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');
const { construirInsert, construirUpdate } = require('../utils/baseDatos');

let admin, vet, ana, carlos;
beforeAll(async () => {
  await reiniciarBase();
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  ana = api(await iniciarSesion('ana@correo.com'));
  carlos = api(await iniciarSesion('carlos@correo.com'));
});
afterAll(() => pool.end());

const HASH_BCRYPT = /^\$2[aby]\$\d{2}\$/;
const parecidoAHash = (texto) => /\$2[aby]\$\d{2}\$/.test(texto);

/** Rutas de todos los campos cuyo nombre sugiere una contraseña (busca en todo el objeto). */
function camposSensibles(valor, ruta = '') {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => camposSensibles(v, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) =>
      (/contrase|password|hash|clave/i.test(k) ? [`${ruta}.${k}`] : []).concat(camposSensibles(v, `${ruta}.${k}`)));
  }
  return [];
}

describe('Contraseñas', () => {
  test('en la base están cifradas con bcrypt, nunca en texto plano', async () => {
    const { rows } = await pool.query('SELECT correo, contrasena_hash FROM usuarios');
    expect(rows.length).toBeGreaterThan(0);
    for (const u of rows) {
      expect(u.contrasena_hash).toMatch(HASH_BCRYPT);
      expect(u.contrasena_hash).not.toBe('Vet12345');
    }
  });

  test('al registrarse se guarda el hash y la respuesta no trae la contraseña', async () => {
    const r = await request(app).post('/api/auth/register').send({
      nombre: 'Nuevo', apellido: 'Usuario', correo: 'nuevo.seguridad@correo.com', contrasena: 'Segura1234',
    });
    expect(r.status).toBe(201);
    expect(camposSensibles(r.body)).toEqual([]);
    expect(JSON.stringify(r.body)).not.toContain('Segura1234');
    const { rows } = await pool.query("SELECT contrasena_hash FROM usuarios WHERE correo = 'nuevo.seguridad@correo.com'");
    expect(rows[0].contrasena_hash).toMatch(HASH_BCRYPT);
    expect(rows[0].contrasena_hash).not.toBe('Segura1234');
  });

  test('el inicio de sesión no devuelve la contraseña ni su hash', async () => {
    const r = await request(app).post('/api/auth/login').send({ correo: 'ana@correo.com', contrasena: 'Vet12345' });
    expect(r.status).toBe(200);
    expect(camposSensibles(r.body)).toEqual([]);
    expect(parecidoAHash(JSON.stringify(r.body))).toBe(false);
  });

  test('ninguna respuesta de la API incluye contraseñas ni hashes', async () => {
    // El administrador no accede al chat (403), por eso '/api/conversaciones' no está en su lista.
    const porRol = [
      [admin, ['/api/perfil', '/api/propietarios', '/api/propietarios/1', '/api/veterinarios', '/api/veterinarios/1',
        '/api/mascotas', '/api/mascotas/1', '/api/citas', '/api/consultas']],
      [vet, ['/api/perfil', '/api/mascotas/1/historia', '/api/mascotas/1/historial', '/api/citas', '/api/consultas',
        '/api/conversaciones', '/api/notificaciones']],
      [ana, ['/api/perfil', '/api/propietarios/me', '/api/mascotas', '/api/mascotas/1', '/api/mascotas/1/historia',
        '/api/citas', '/api/conversaciones/veterinarios', '/api/notificaciones']],
    ];
    for (const [usuario, rutas] of porRol) {
      for (const ruta of rutas) {
        const r = await usuario.get(ruta);
        expect([ruta, r.status]).toEqual([ruta, 200]);
        expect([ruta, camposSensibles(r.body)]).toEqual([ruta, []]);
        expect([ruta, parecidoAHash(JSON.stringify(r.body))]).toEqual([ruta, false]);
      }
    }
  });

  test('el administrador no accede al chat (403) y la respuesta no filtra datos sensibles', async () => {
    const r = await admin.get('/api/conversaciones');
    expect(r.status).toBe(403);
    expect(camposSensibles(r.body)).toEqual([]);
    expect(parecidoAHash(JSON.stringify(r.body))).toBe(false);
  });
});

describe('Inyección SQL', () => {
  const PAYLOADS = ["' OR '1'='1", "'; DROP TABLE mascotas; --", "%' UNION SELECT contrasena_hash FROM usuarios --"];

  test('el inicio de sesión no se puede burlar con SQL', async () => {
    for (const correo of ["' OR '1'='1", "admin@vetcontrol.com' --", "x' OR 1=1 --"]) {
      const r = await request(app).post('/api/auth/login').send({ correo, contrasena: "' OR '1'='1" });
      expect(r.status).not.toBe(200);
      expect(r.body.token).toBeUndefined();
    }
  });

  test('las búsquedas tratan el texto como dato: no devuelven filas ajenas y no rompen nada', async () => {
    const usuariosAntes = (await pool.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n;
    for (const payload of PAYLOADS) {
      const q = encodeURIComponent(payload);
      for (const [usuario, ruta] of [[carlos, '/api/mascotas'], [admin, '/api/propietarios'], [admin, '/api/veterinarios'],
        [vet, '/api/consultas'], [vet, '/api/mascotas']]) {
        const r = await usuario.get(`${ruta}?q=${q}`);
        expect([ruta, r.status]).toEqual([ruta, 200]);
        expect([ruta, r.body.datos]).toEqual([ruta, []]);
      }
    }
    expect((await pool.query("SELECT to_regclass('public.mascotas') AS t")).rows[0].t).not.toBeNull();
    expect((await pool.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n).toBe(usuariosAntes);
  });

  test('un id con código SQL se rechaza (400)', async () => {
    expect((await vet.get('/api/mascotas/1%20OR%201=1')).status).toBe(400);
    expect((await vet.get('/api/mascotas/1;DROP%20TABLE%20mascotas')).status).toBe(400);
  });

  test('los valores siempre viajan como parámetros y los identificadores se validan', () => {
    const q = construirUpdate('mascotas', 'id_mascota', 1, { nombre: "Max'; DROP TABLE mascotas; --", peso_kg: 3 });
    expect(q.text).not.toContain('DROP');
    expect(q.values).toEqual(["Max'; DROP TABLE mascotas; --", 3, 1]);
    expect(construirInsert('citas', { id_mascota: 1, motivo: 'x' }, 'id_cita').text).toMatch(/\$1, \$2\) RETURNING id_cita/);

    expect(() => construirUpdate('mascotas', 'id_mascota', 1, { "nombre = 'x'; DROP TABLE mascotas; --": 'a' })).toThrow(/no permitido/);
    expect(() => construirInsert('mascotas; DROP TABLE usuarios', { a: 1 })).toThrow(/no permitido/);
    expect(() => construirInsert('citas', { a: 1 }, 'id_cita; DROP TABLE usuarios')).toThrow(/no permitido/);
  });
});
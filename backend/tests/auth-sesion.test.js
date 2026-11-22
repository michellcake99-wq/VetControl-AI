// Ep7-Hu3: sesión (expiración, usuario desactivado) y bloqueo tras 5 intentos fallidos en 15 minutos
const jwt = require('jsonwebtoken');
const { pool, request, app, reiniciarBase, iniciarSesion } = require('./helpers');

const login = (correo, contrasena) => request(app).post('/api/auth/login').send({ correo, contrasena });
const fallar = async (correo, veces) => {
  let r;
  for (let i = 0; i < veces; i++) r = await login(correo, 'incorrecta');
  return r;
};

beforeAll(reiniciarBase);
beforeEach(() => pool.query('TRUNCATE intentos_login'));
afterAll(() => pool.end());

describe('Bloqueo por intentos fallidos', () => {
  test('los primeros 4 intentos fallidos responden 401 y el quinto bloquea (429)', async () => {
    for (let i = 1; i <= 4; i++) {
      const r = await login('ana@correo.com', 'incorrecta');
      expect(r.status).toBe(401);
      expect(r.body.mensaje).toBe('Correo o contraseña incorrectos');
    }
    const quinto = await login('ana@correo.com', 'incorrecta');
    expect(quinto.status).toBe(429);
    expect(quinto.body).toMatchObject({ codigo: 'cuenta_bloqueada', reintentar_en_minutos: 15 });
    expect(quinto.body.mensaje).toMatch(/Intenta de nuevo en 15 minutos/);
  });

  test('bloqueada, ni la contraseña correcta deja entrar', async () => {
    await fallar('ana@correo.com', 5);
    const r = await login('ana@correo.com', 'Vet12345');
    expect(r.status).toBe(429);
    expect(r.body.token).toBeUndefined();
    // y los intentos durante el bloqueo no lo alargan
    await fallar('ana@correo.com', 3);
    expect((await pool.query("SELECT count(*)::int AS n FROM intentos_login WHERE correo = 'ana@correo.com'")).rows[0].n).toBe(5);
  });

  test('pasados 15 minutos se puede volver a intentar', async () => {
    await fallar('ana@correo.com', 5);
    await pool.query("UPDATE intentos_login SET fecha = now() - interval '16 minutes'");
    const r = await login('ana@correo.com', 'Vet12345');
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });

  test('solo cuentan los intentos de los últimos 15 minutos', async () => {
    await fallar('ana@correo.com', 4);
    await pool.query("UPDATE intentos_login SET fecha = now() - interval '20 minutes' WHERE id_intento IN (SELECT id_intento FROM intentos_login LIMIT 2)");
    expect((await login('ana@correo.com', 'incorrecta')).status).toBe(401);
  });

  test('un inicio de sesión correcto borra los intentos anteriores', async () => {
    await fallar('ana@correo.com', 4);
    expect((await login('ana@correo.com', 'Vet12345')).status).toBe(200);
    expect((await pool.query("SELECT count(*)::int AS n FROM intentos_login WHERE correo = 'ana@correo.com'")).rows[0].n).toBe(0);
    expect((await fallar('ana@correo.com', 4)).status).toBe(401);
  });

  test('el bloqueo es por correo (no afecta a otros) y no distingue mayúsculas', async () => {
    await fallar('ana@correo.com', 5);
    expect((await login('carlos@correo.com', 'Vet12345')).status).toBe(200);
    expect((await login('ANA@correo.com', 'Vet12345')).status).toBe(429);
  });

  test('un correo que no existe responde igual y también se bloquea', async () => {
    const r = await login('nadie@correo.com', 'x');
    expect(r.status).toBe(401);
    expect(r.body.mensaje).toBe('Correo o contraseña incorrectos');
    expect((await fallar('nadie@correo.com', 4)).status).toBe(429);
  });
});

describe('Sesión', () => {
  test('el token dura 2 horas', async () => {
    const token = await iniciarSesion('ana@correo.com');
    const { iat, exp } = jwt.decode(token);
    expect(exp - iat).toBe(2 * 3600);
  });

  test('con el token vencido responde 401 con un mensaje claro y un código', async () => {
    const vencido = jwt.sign({ id_usuario: 4, rol: 'propietario' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const r = await request(app).get('/api/citas').set('Authorization', `Bearer ${vencido}`);
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ codigo: 'sesion_expirada', mensaje: expect.stringMatching(/sesión expiró/) });
    const malo = await request(app).get('/api/citas').set('Authorization', 'Bearer cualquiera');
    expect(malo.status).toBe(401);
    expect(malo.body.codigo).toBeUndefined();
  });

  test('un usuario desactivado no puede iniciar sesión', async () => {
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE correo = 'carlos@correo.com'");
    const r = await login('carlos@correo.com', 'Vet12345');
    expect(r.status).toBe(403);
    expect(r.body.mensaje).toMatch(/desactivada/);
    await pool.query("UPDATE usuarios SET activo = TRUE WHERE correo = 'carlos@correo.com'");
  });

  test('un token vigente deja de servir si la cuenta se desactiva', async () => {
    const token = await iniciarSesion('carlos@correo.com');
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE correo = 'carlos@correo.com'");
    expect((await request(app).get('/api/citas').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    await pool.query("UPDATE usuarios SET activo = TRUE WHERE correo = 'carlos@correo.com'");
  });
});

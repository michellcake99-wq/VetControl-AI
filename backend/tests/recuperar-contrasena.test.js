// Ep7-Hu4: recuperación de contraseña por correo
const crypto = require('node:crypto');
const { pool, request, app, reiniciarBase } = require('./helpers');

const post = (ruta, cuerpo) => request(app).post(`/api/auth/${ruta}`).send(cuerpo);
const login = (correo, contrasena) => post('login', { correo, contrasena });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

let enlaces;
beforeAll(reiniciarBase);
beforeEach(async () => {
  await pool.query('TRUNCATE tokens_recuperacion, intentos_login');
  enlaces = [];
  process.env.BREVO_API_KEY = 'x';
  process.env.CORREO_REMITENTE = 'clinica@ejemplo.com';
  process.env.FRONTEND_URL = 'https://vetcontrol.ejemplo.com';
  // Se simula Brevo y se guarda el correo enviado para sacar el enlace
  jest.spyOn(global, 'fetch').mockImplementation(async (_url, opts) => {
    const c = JSON.parse(opts.body);
    enlaces.push({ para: c.to[0].email, texto: c.textContent });
    return { ok: true, status: 201 };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.BREVO_API_KEY;
  delete process.env.CORREO_REMITENTE;
  delete process.env.FRONTEND_URL;
});
afterAll(() => pool.end());

const tokenDelCorreo = (i = -1) => enlaces.at(i).texto.match(/token=([a-f0-9]{64})/)[1];
const solicitar = (correo) => post('olvide-contrasena', { correo });

describe('Solicitar el enlace', () => {
  test('envía el correo con un enlace de un solo uso y guarda solo el hash', async () => {
    const r = await solicitar('ana@correo.com');
    expect(r.status).toBe(200);
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].para).toBe('ana@correo.com');
    expect(enlaces[0].texto).toContain('https://vetcontrol.ejemplo.com/restablecer-contrasena?token=');
    const token = tokenDelCorreo();
    const { rows } = await pool.query('SELECT * FROM tokens_recuperacion');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(sha(token));
    expect(rows[0].token_hash).not.toBe(token);
    expect(JSON.stringify(rows[0])).not.toContain(token);
    // vale 1 hora
    const minutos = (new Date(rows[0].fecha_expiracion) - new Date(rows[0].fecha_creacion)) / 60000;
    expect(Math.round(minutos)).toBe(60);
  });

  test('responde lo mismo si el correo existe o no, y no envía nada si no existe', async () => {
    const existe = await solicitar('ana@correo.com');
    const noExiste = await solicitar('nadie@correo.com');
    expect(noExiste.status).toBe(200);
    expect(noExiste.body).toEqual(existe.body);
    expect(enlaces).toHaveLength(1);
  });

  test('no envía a cuentas desactivadas y valida el formato del correo', async () => {
    await pool.query("UPDATE usuarios SET activo = FALSE WHERE correo = 'marta@correo.com'");
    expect((await solicitar('marta@correo.com')).status).toBe(200);
    expect(enlaces).toHaveLength(0);
    await pool.query("UPDATE usuarios SET activo = TRUE WHERE correo = 'marta@correo.com'");
    expect((await solicitar('no-es-correo')).status).toBe(400);
  });

  test('un enlace nuevo anula el anterior y hay un tope por hora', async () => {
    await solicitar('ana@correo.com');
    const primero = tokenDelCorreo();
    await solicitar('ana@correo.com');
    expect((await post('verificar-token-recuperacion', { token: primero })).status).toBe(400);
    expect((await post('verificar-token-recuperacion', { token: tokenDelCorreo() })).status).toBe(200);
    for (let i = 0; i < 6; i++) await solicitar('ana@correo.com');
    expect(enlaces).toHaveLength(5); // el sexto y siguientes no envían correo
  });
});

describe('Restablecer la contraseña', () => {
  const restablecer = (token, contrasena = 'NuevaClave123', confirmacion = contrasena) =>
    post('restablecer-contrasena', { token, contrasena, confirmacion });

  test('cambia la contraseña, que queda encriptada, y ya se puede iniciar sesión con la nueva', async () => {
    await solicitar('ana@correo.com');
    const r = await restablecer(tokenDelCorreo());
    expect(r.status).toBe(200);
    expect(r.body.mensaje).toMatch(/actualizó/);
    expect((await login('ana@correo.com', 'NuevaClave123')).status).toBe(200);
    expect((await login('ana@correo.com', 'Vet12345')).status).toBe(401);
    const { rows } = await pool.query("SELECT contrasena_hash FROM usuarios WHERE correo = 'ana@correo.com'");
    expect(rows[0].contrasena_hash).toMatch(/^\$2[aby]\$/);
    await pool.query("UPDATE usuarios SET contrasena_hash = (SELECT contrasena_hash FROM usuarios WHERE correo = 'carlos@correo.com') WHERE correo = 'ana@correo.com'");
  });

  test('el enlace solo sirve una vez', async () => {
    await solicitar('carlos@correo.com');
    const token = tokenDelCorreo();
    expect((await restablecer(token)).status).toBe(200);
    const segundo = await restablecer(token, 'OtraClave456');
    expect(segundo.status).toBe(400);
    expect(segundo.body.mensaje).toMatch(/no es válido o ya venció/);
    expect((await post('verificar-token-recuperacion', { token })).status).toBe(400);
    await pool.query("UPDATE usuarios SET contrasena_hash = (SELECT contrasena_hash FROM usuarios WHERE correo = 'ana@correo.com') WHERE correo = 'carlos@correo.com'");
  });

  test('un enlace vencido o inventado responde el mismo mensaje', async () => {
    await solicitar('marta@correo.com');
    const token = tokenDelCorreo();
    await pool.query("UPDATE tokens_recuperacion SET fecha_expiracion = now() - interval '1 minute'");
    const vencido = await restablecer(token);
    expect(vencido.status).toBe(400);
    expect(vencido.body.mensaje).toMatch(/no es válido o ya venció/);
    const inventado = await restablecer(crypto.randomBytes(32).toString('hex'));
    expect(inventado.status).toBe(400);
    expect(inventado.body.mensaje).toBe(vencido.body.mensaje);
    expect((await restablecer('abc')).status).toBe(400);
  });

  test('exige mínimo 8 caracteres y que las dos contraseñas coincidan (sin gastar el enlace)', async () => {
    await solicitar('marta@correo.com');
    const token = tokenDelCorreo();
    const corta = await restablecer(token, 'corta');
    expect(corta.status).toBe(400);
    expect(corta.body.detalles[0].campo).toBe('contrasena');
    const distinta = await restablecer(token, 'NuevaClave123', 'NuevaClave124');
    expect(distinta.status).toBe(400);
    expect(distinta.body.detalles[0]).toMatchObject({ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden' });
    expect((await post('verificar-token-recuperacion', { token })).status).toBe(200);
    expect((await restablecer(token)).status).toBe(200);
  });

  test('desbloquea la cuenta que estaba bloqueada por intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) await login('vet2@vetcontrol.com', 'mala');
    expect((await login('vet2@vetcontrol.com', 'Vet12345')).status).toBe(429);
    await solicitar('vet2@vetcontrol.com');
    await restablecer(tokenDelCorreo(), 'ClaveNueva789');
    expect((await login('vet2@vetcontrol.com', 'ClaveNueva789')).status).toBe(200);
  });
});

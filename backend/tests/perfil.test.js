// Ep4-Hu4: Mi perfil (datos personales y cambio de contraseña)
const { pool, request, app, reiniciarBase, iniciarSesion, api } = require('./helpers');

let ana, carlos, vet, admin;
beforeAll(async () => {
  await reiniciarBase();
  ana = api(await iniciarSesion('ana@correo.com'));
  carlos = api(await iniciarSesion('carlos@correo.com'));
  vet = api(await iniciarSesion('vet@vetcontrol.com'));
  admin = api(await iniciarSesion('admin@vetcontrol.com'));
});
afterAll(() => pool.end());

describe('Ver el perfil', () => {
  test('exige sesión', async () => {
    expect((await request(app).get('/api/perfil')).status).toBe(401);
  });

  test('el propietario ve nombre, apellido, correo, teléfono, documento y dirección', async () => {
    const r = await ana.get('/api/perfil');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ rol: 'propietario', nombre: 'Ana', apellido: 'Torres', correo: 'ana@correo.com' });
    for (const campo of ['telefono', 'tipo_documento', 'numero_documento', 'direccion']) expect(r.body).toHaveProperty(campo);
    expect(r.body).not.toHaveProperty('contrasena_hash');
  });

  test('el veterinario ve además su tarjeta profesional y su especialidad', async () => {
    const r = await vet.get('/api/perfil');
    expect(r.body).toMatchObject({ rol: 'veterinario', correo: 'vet@vetcontrol.com' });
    for (const campo of ['telefono', 'tarjeta_profesional', 'especialidad']) expect(r.body).toHaveProperty(campo);
    expect(r.body).not.toHaveProperty('numero_documento');
  });

  test('el administrador ve sus datos básicos', async () => {
    const r = await admin.get('/api/perfil');
    expect(r.body).toMatchObject({ rol: 'administrador', correo: 'admin@vetcontrol.com' });
  });

  test('cada usuario solo ve su propio perfil', async () => {
    expect((await carlos.get('/api/perfil')).body.correo).toBe('carlos@correo.com');
  });
});

describe('Editar el perfil', () => {
  test('el propietario edita nombre, teléfono y dirección', async () => {
    const r = await carlos.put('/api/perfil', { nombre: 'Carlos Andrés', telefono: '3001234567', direccion: 'Calle 10 # 5-20' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ nombre: 'Carlos Andrés', telefono: '3001234567', direccion: 'Calle 10 # 5-20' });
    expect((await carlos.get('/api/perfil')).body.nombre).toBe('Carlos Andrés');
  });

  test('el veterinario edita nombre, teléfono y especialidad', async () => {
    const r = await vet.put('/api/perfil', { apellido: 'Quintero R.', telefono: '3109998877', especialidad: 'Cirugía' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ apellido: 'Quintero R.', telefono: '3109998877', especialidad: 'Cirugía' });
  });

  test('el administrador edita su nombre', async () => {
    expect((await admin.put('/api/perfil', { nombre: 'Admin Principal' })).body.nombre).toBe('Admin Principal');
  });

  test('el correo y el rol no se pueden cambiar', async () => {
    for (const cuerpo of [{ correo: 'otro@correo.com' }, { rol: 'administrador' }, { nombre: 'Ana', correo: 'otro@correo.com' }]) {
      const r = await ana.put('/api/perfil', cuerpo);
      expect(r.status).toBe(400);
      expect(r.body.detalles[0].mensaje).toMatch(/no se pueden modificar/);
    }
    const perfil = (await ana.get('/api/perfil')).body;
    expect(perfil).toMatchObject({ correo: 'ana@correo.com', rol: 'propietario' });
  });

  test('valida los datos con mensajes claros', async () => {
    const r = await ana.put('/api/perfil', { nombre: '  ', telefono: 'abc' });
    expect(r.status).toBe(400);
    expect(r.body.detalles.map((d) => d.campo).sort()).toEqual(['nombre', 'telefono']);
    expect((await ana.put('/api/perfil', {})).status).toBe(400);
  });

  test('ignora campos ajenos al rol (un propietario no puede poner una tarjeta profesional)', async () => {
    const r = await carlos.put('/api/perfil', { nombre: 'Carlos', tarjeta_profesional: 'TP-1', id_usuario: 1 });
    expect(r.status).toBe(200);
    expect(r.body).not.toHaveProperty('tarjeta_profesional');
    expect(r.body.id_usuario).not.toBe(1);
  });

  test('el documento y la tarjeta profesional, una vez registrados, solo los cambia el personal', async () => {
    const mio = (await ana.get('/api/perfil')).body;
    expect((await ana.put('/api/perfil', { numero_documento: '99999999' })).status).toBe(403);
    expect((await ana.put('/api/perfil', { numero_documento: mio.numero_documento, telefono: '3000000000' })).status).toBe(200);
    const v = (await vet.get('/api/perfil')).body;
    expect((await vet.put('/api/perfil', { tarjeta_profesional: 'OTRA-1' })).status).toBe(403);
    expect((await vet.put('/api/perfil', { tarjeta_profesional: v.tarjeta_profesional })).status).toBe(200);
  });

  test('un documento ya usado por otra persona responde 409', async () => {
    await pool.query("UPDATE propietarios SET numero_documento = NULL WHERE id_usuario = (SELECT id_usuario FROM usuarios WHERE correo = 'marta@correo.com')");
    const marta = api(await iniciarSesion('marta@correo.com'));
    const docAna = (await ana.get('/api/perfil')).body.numero_documento;
    expect((await marta.put('/api/perfil', { numero_documento: docAna })).status).toBe(409);
    expect((await marta.put('/api/perfil', { numero_documento: 'NUEVO-123' })).status).toBe(200);
  });
});

describe('Cambiar la contraseña', () => {
  const cambiar = (u, actual, nueva, confirmacion = nueva) =>
    u.put('/api/perfil/contrasena', { contrasena_actual: actual, contrasena_nueva: nueva, confirmacion });

  test('exige la contraseña actual correcta (400, sin cerrar la sesión)', async () => {
    const r = await cambiar(carlos, 'incorrecta', 'ClaveNueva123');
    expect(r.status).toBe(400);
    expect(r.body.detalles[0]).toMatchObject({ campo: 'contrasena_actual', mensaje: 'La contraseña actual es incorrecta' });
    expect((await carlos.get('/api/perfil')).status).toBe(200);
  });

  test('valida longitud, confirmación y que sea distinta de la actual', async () => {
    expect((await cambiar(carlos, 'Vet12345', 'corta')).body.detalles[0].campo).toBe('contrasena_nueva');
    expect((await cambiar(carlos, 'Vet12345', 'ClaveNueva123', 'ClaveNueva124')).body.detalles[0].campo).toBe('confirmacion');
    expect((await cambiar(carlos, 'Vet12345', 'Vet12345')).body.detalles[0].mensaje).toMatch(/distinta/);
  });

  test('con la actual correcta la cambia (encriptada) y ya se entra con la nueva', async () => {
    const r = await cambiar(carlos, 'Vet12345', 'ClaveNueva123');
    expect(r.status).toBe(200);
    const login = (contrasena) => request(app).post('/api/auth/login').send({ correo: 'carlos@correo.com', contrasena });
    expect((await login('ClaveNueva123')).status).toBe(200);
    expect((await login('Vet12345')).status).toBe(401);
    const { rows } = await pool.query("SELECT contrasena_hash FROM usuarios WHERE correo = 'carlos@correo.com'");
    expect(rows[0].contrasena_hash).toMatch(/^\$2[aby]\$/);
  });
});

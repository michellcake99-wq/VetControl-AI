// Foto de cada mascota (se guarda como data URL ya reducida por el navegador)
const { pool, reiniciarBase, iniciarSesion, api } = require('./helpers');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let ana, vet;

beforeAll(async () => {
    await reiniciarBase();
    ana = api(await iniciarSesion('ana@correo.com'));
    vet = api(await iniciarSesion('vet@vetcontrol.com'));
});
afterAll(() => pool.end());

test('la propietaria agrega la foto de su mascota y se ve en el detalle, el listado y la historia', async () => {
    expect((await ana.put('/api/mascotas/1', { foto: PNG_1PX })).status).toBe(200);
    expect((await ana.get('/api/mascotas/1')).body.foto).toBe(PNG_1PX);
    const lista = (await ana.get('/api/mascotas')).body.datos;
    expect(lista.find((m) => m.id_mascota === 1).foto).toBe(PNG_1PX);
    const historia = (await vet.get('/api/mascotas/1/historia')).body;
    expect(historia.mascota.foto).toBe(PNG_1PX);
});

test('se puede registrar una mascota con foto', async () => {
    const r = await ana.post('/api/mascotas', { nombre: 'Copito', especie: 'felino', foto: PNG_1PX });
    expect(r.status).toBe(201);
    expect(r.body.foto).toBe(PNG_1PX);
});

test('rechaza archivos que no son imágenes y fotos demasiado pesadas', async () => {
    const texto = await ana.put('/api/mascotas/1', { foto: 'data:text/plain;base64,SG9sYQ==' });
    expect(texto.status).toBe(400);
    expect(texto.body.detalles[0].campo).toBe('foto');
    const pesada = await ana.put('/api/mascotas/1', { foto: `data:image/jpeg;base64,${'A'.repeat(490000)}` });
    expect(pesada.status).toBe(400);
});

test('la foto se puede quitar', async () => {
    expect((await ana.put('/api/mascotas/1', { foto: null })).status).toBe(200);
    expect((await ana.get('/api/mascotas/1')).body.foto).toBeNull();
});

test('la historia clínica trae los datos del propietario para el formato', async () => {
    const { propietario, mascota } = (await ana.get('/api/mascotas/1/historia')).body;
    expect(propietario).toMatchObject({ nombre: 'Ana', correo: 'ana@correo.com', numero_documento: '1091000001' });
    expect(mascota).toHaveProperty('color');
    expect(mascota).toHaveProperty('esterilizado');
});

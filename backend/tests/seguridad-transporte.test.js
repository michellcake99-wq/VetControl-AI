// Ep7-Hu2: CORS limitado al dominio del frontend, HTTPS en producción y configuración segura.
// No necesita base de datos.
const request = require('supertest');
const app = require('../server');
const seguridad = require('../middleware/seguridad');
const manejoErrores = require('../middleware/manejoErrores');

const FRONTEND = 'https://vetcontrol.example.com';
const entorno = { ...process.env };
beforeEach(() => {
  process.env.FRONTEND_URL = FRONTEND;
  process.env.NODE_ENV = 'test';
});
afterAll(() => {
  process.env = { ...entorno };
});

describe('CORS limitado al frontend', () => {
  test('el dominio del frontend puede llamar a la API', async () => {
    const r = await request(app).get('/').set('Origin', FRONTEND);
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(r.headers.vary).toMatch(/Origin/);
  });

  test('un dominio ajeno recibe 403 y ninguna cabecera CORS', async () => {
    const r = await request(app).get('/').set('Origin', 'https://sitio-malicioso.example');
    expect(r.status).toBe(403);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('nunca se responde con el comodín *', async () => {
    for (const origen of [FRONTEND, 'https://otro.example', 'null']) {
      const r = await request(app).get('/').set('Origin', origen);
      expect(r.headers['access-control-allow-origin']).not.toBe('*');
    }
  });

  test('la petición previa (preflight) se acepta solo para el frontend', async () => {
    const pedir = (origen) =>
      request(app)
        .options('/api/mascotas')
        .set('Origin', origen)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
    const bueno = await pedir(FRONTEND);
    expect(bueno.status).toBe(204);
    expect(bueno.headers['access-control-allow-headers']).toMatch(/Authorization/);
    expect((await pedir('https://sitio-malicioso.example')).status).toBe(403);
  });

  test('varios dominios en FRONTEND_URL, y localhost solo fuera de producción', async () => {
    process.env.FRONTEND_URL = `${FRONTEND}/, https://admin.example.com`;
    expect(seguridad.origenesPermitidos()).toEqual(
      expect.arrayContaining([FRONTEND, 'https://admin.example.com', 'http://localhost:5173'])
    );
    process.env.NODE_ENV = 'production';
    expect(seguridad.origenesPermitidos()).toEqual([FRONTEND, 'https://admin.example.com']);
  });

  test('el chat (Socket.IO) aplica la misma lista', () => {
    const decidir = (origen) => {
      let permitido;
      seguridad.origenSocket(origen, (_e, ok) => (permitido = ok));
      return permitido;
    };
    expect(decidir(FRONTEND)).toBe(true);
    expect(decidir('https://sitio-malicioso.example')).toBe(false);
  });
});

describe('HTTPS en producción', () => {
  test('en producción, HTTP se redirige a HTTPS conservando la ruta', async () => {
    process.env.NODE_ENV = 'production';
    const r = await request(app).get('/api/mascotas?q=max').set('x-forwarded-proto', 'http').set('Host', 'api.example.com');
    expect(r.status).toBe(308);
    expect(r.headers.location).toBe('https://api.example.com/api/mascotas?q=max');
  });

  test('en producción, por HTTPS se atiende y se envía HSTS', async () => {
    process.env.NODE_ENV = 'production';
    const r = await request(app).get('/').set('x-forwarded-proto', 'https');
    expect(r.status).toBe(200);
    expect(r.headers['strict-transport-security']).toMatch(/max-age=\d+/);
  });

  test('en desarrollo no se redirige ni se envía HSTS', async () => {
    const r = await request(app).get('/');
    expect(r.status).toBe(200);
    expect(r.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('Cabeceras y configuración', () => {
  test('cabeceras de seguridad y sin caché; no se anuncia Express', async () => {
    const r = await request(app).get('/');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-frame-options']).toBe('DENY');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  test('en producción el servidor no arranca sin JWT_SECRET seguro, FRONTEND_URL o con http://', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'corto';
    expect(() => seguridad.verificarConfiguracion()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.FRONTEND_URL = '';
    expect(() => seguridad.verificarConfiguracion()).toThrow(/FRONTEND_URL/);
    process.env.FRONTEND_URL = 'http://vetcontrol.example.com';
    expect(() => seguridad.verificarConfiguracion()).toThrow(/https/);
    process.env.FRONTEND_URL = FRONTEND;
    expect(() => seguridad.verificarConfiguracion()).not.toThrow();
  });

  test('los errores de PostgreSQL no revelan datos de otras personas en producción', () => {
    const error = { code: '23505', detail: 'Key (numero_documento)=(1234567) already exists.' };
    const responder = () => {
      let cuerpo;
      const res = { status: () => res, json: (c) => (cuerpo = c) };
      manejoErrores(error, {}, res, () => {});
      return cuerpo;
    };
    process.env.NODE_ENV = 'production';
    expect(responder().detalle).toBeUndefined();
    process.env.NODE_ENV = 'test';
    expect(responder().detalle).toBe(error.detail);
  });
});
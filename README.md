## Matriz de permisos por rol (Ep7-Hu1)

| Recurso / Endpoint                          | Propietario                          | Veterinario | Administrador |
|----------------------------------------------|----------------------------------------|-------------|----------------|
| `POST /api/auth/register`                    | Público (se registra como propietario) | Público (se registra como veterinario) | No disponible desde el registro público |
| `POST /api/auth/login`                       | Público                                | Público     | Público |
| `GET /api/propietarios`                      | ❌ 403                                  | ✅          | ✅ |
| `GET /api/propietarios/me`                   | ✅ (su propio perfil)                   | ❌ 403      | ❌ 403 |
| `GET /api/propietarios/:id`, `PUT .../:id`   | ✅ solo si `:id` es el suyo             | ✅          | ✅ |
| `POST /api/propietarios`                     | ❌ 403                                  | ✅          | ✅ |
| `DELETE /api/propietarios/:id`               | ❌ 403                                  | ✅          | ✅ |
| `GET /api/mascotas`                          | ✅ solo las suyas                       | ✅ todas    | ✅ todas |
| `POST /api/mascotas`                         | ✅ a su propio nombre                   | ✅          | ✅ |
| `PUT /api/mascotas/:id`                      | ✅ solo si la mascota es suya           | ✅          | ✅ |
| `DELETE /api/mascotas/:id`                   | ❌ 403                                  | ✅          | ✅ |
| `GET/POST/PUT/DELETE /api/veterinarios/**`   | ❌ 403                                  | ❌ 403      | ✅ |
| `GET /api/historias/**`, `/api/consultas/:id`, `/api/mascotas/:id/historia` | ✅ solo de sus mascotas | ✅ | ✅ |
| `PUT /api/historias/:id`, `POST .../consultas`, `POST .../vacunas`, `POST .../tratamientos` | ❌ 403 | ✅ | ❌ 403 |
| `POST /api/tratamientos/:id/evoluciones`     | ✅ solo de sus mascotas                 | ❌ 403      | ❌ 403 |
| `GET /api/citas`                             | ✅ solo las de sus mascotas             | ✅ su agenda | ✅ todas |
| `POST /api/citas`                            | ✅ para sus mascotas                    | ✅ en su propia agenda | ✅ |
| `PUT /api/citas/:id/estado`                  | según la transición permitida          | según la transición permitida | según la transición permitida |
| `/api/conversaciones/**` y chat (Socket.IO)  | ✅ solo sus conversaciones              | ✅ solo sus conversaciones | ❌ (no participa del chat) |
| `GET /api/vacunas/catalogo`                  | ✅                                      | ✅          | ✅ |
| `PUT /api/vacunas/:id` (corregir vacuna)     | ❌ 403                                  | ✅          | ❌ 403 |
| `POST /api/ia/consultar`                     | ✅ (con `id_mascota`, solo sus mascotas) | ✅         | ✅ |

### Cómo se aplica — backend
1. `authMiddleware.js` verifica el JWT en cada endpoint protegido. Sin token o expirado → `401`.
2. `cargarPerfil.js` completa `req.usuario` con el rol y el id de perfil (propietario/veterinario) y confirma que la cuenta siga activa.
3. `permitirRoles(...roles)` se aplica en las rutas que lo necesitan y responde `403` si el rol no está permitido.
4. Dentro de los controladores, `esPersonal(req.usuario)` distingue entre "ve todo" (veterinario/administrador) y "solo lo suyo" (propietario).
5. `manejoErrores.js` centraliza y traduce esas respuestas de error.

### Cómo se aplica — frontend
- La sesión la maneja `utils/sesion.js` (Ep3-Hu15): guarda el token y los datos del usuario (incluido su rol) al iniciar sesión.
- `RutaProtegida` redirige a `/iniciar-sesion` si no hay sesión o si el token venció, y a `/acceso-denegado` si la ruta indica `roles` y el del usuario no está entre ellos.
- Las rutas por rol están en `App.jsx` (`soloPara(...)`): propietarios para el personal de la clínica, veterinarios solo para el administrador y el chat solo para propietario y veterinario.
- El menú lateral (`Sidebar.jsx`) solo muestra las opciones permitidas para el rol actual (`roles` en `routes.js`).
- `services/api.js` envía el token en cada petición; si el backend responde `401`, cierra la sesión y lleva al inicio de sesión.

### Pruebas con los 3 roles
Backend — automatizadas en `backend/tests/veterinarios.test.js` (`npm test` en `backend/`):
- [x] Sin token: `401`.
- [x] Propietario: no puede ver `/api/propietarios` (lista completa) ni `/api/veterinarios/**` (`403`).
- [x] Veterinario: puede ver propietarios, pero no `/api/veterinarios/**` (`403`).
- [x] Administrador: acceso completo, incluyendo `/api/veterinarios/**`.

Frontend — se prueba a mano con los usuarios de `database/seed.sql` (clave `Vet12345`):
- [ ] Con cada rol, confirmar que el Sidebar muestra solo sus opciones.
- [ ] Entrar a `/veterinarios` sin ser administrador redirige a `/acceso-denegado`.
- [ ] Recargar la página con sesión iniciada mantiene al usuario en la misma pantalla.

## Asistente de IA (Ep6-Hu1): configuración

El backend usa por defecto **Groq**, que tiene un nivel gratuito sin tarjeta de crédito.

1. Crear una cuenta en https://console.groq.com y, en **API Keys**, crear una clave.
2. En `backend/.env` agregar `IA_API_KEY=<la clave>` (ver `backend/.env.example`). La clave **nunca** se sube a GitHub.
3. Reiniciar el backend y probar con la carpeta *4. Asistente de IA* de la colección de Postman (`docs/`).

El modelo (`IA_MODELO`), el tiempo máximo de espera y el límite de consultas por usuario se cambian desde el `.env`, sin tocar el código. Detalles en `docs/api.md`.

## Migraciones para bases con datos (Supabase)

`database/schema.sql` **borra y vuelve a crear** todas las tablas, así que no debe ejecutarse en una base que ya tiene datos. Para actualizar Supabase se ejecutan, en orden, los archivos de `database/migraciones/` (SQL Editor → pegar → Run). No borran nada y se pueden ejecutar más de una vez.

| Archivo | Historia | Qué hace |
|---|---|---|
| `001_ep4-hu1_catalogo_vacunas.sql` | Ep4-Hu1 | Crea el catálogo de vacunas y enlaza las vacunas ya registradas |
| `002_ep6-hu1_interacciones_ia.sql` | Ep6-Hu1 | Crea la tabla `interacciones_ia` |
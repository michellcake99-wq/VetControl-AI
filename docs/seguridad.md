# Seguridad de la información clínica (Ep7-Hu2)

Cómo cumple VetControl AI cada criterio de aceptación y cómo comprobarlo.

| Criterio | Cómo se cumple | Dónde | Prueba |
|---|---|---|---|
| Un propietario no ve datos de mascotas ajenas (403) | Toda ruta con una mascota, historia, consulta, tratamiento, cita o conversación pasa por una función de acceso (`obtenerMascotaAutorizada`, `obtenerHistoriaAutorizada`, `verificarPropioOPersonal`…). Los listados filtran por propietario. | `backend/utils/acceso.js` y controladores | `seguridad-acceso.test.js` |
| Contraseñas cifradas y nunca devueltas | `bcrypt` (10 rondas) al registrar, cambiar o restablecer. Las respuestas listan las columnas una a una y nunca incluyen `contrasena_hash`. | `routes/auth.js`, controladores | `seguridad-datos.test.js` |
| Consultas con parámetros | Los valores van siempre como `$1, $2…`. Los nombres de tabla y columna (que no pueden ser parámetros) se validan en `identificador()`. | `utils/baseDatos.js` | `seguridad-datos.test.js` |
| `.env` fuera del repositorio | `.gitignore` en la raíz, en `backend/` y en `frontend/`. La plantilla `backend/.env.example` sí se sube. | `.gitignore` | ver "Comprobar el repositorio" |
| CORS limitado y HTTPS en el despliegue | Lista blanca en `FRONTEND_URL` (nunca `*`), también para el chat (Socket.IO). En producción se redirige HTTP→HTTPS (308) y se envía HSTS. El servidor no arranca en producción con `JWT_SECRET` débil o `FRONTEND_URL` sin https. | `middleware/seguridad.js`, `server.js` | `seguridad-transporte.test.js` |

## Variables para el despliegue

En el servicio donde corre el backend:

```
NODE_ENV=production
FRONTEND_URL=https://dominio-del-frontend.com      # exactamente el dominio, sin barra final
JWT_SECRET=<cadena aleatoria de 32+ caracteres>
DB_SSL=true
```

En el frontend (si queda en otro dominio que la API): `VITE_API_URL=https://dominio-de-la-api.com`

El hosting debe terminar el HTTPS (Render, Railway, Vercel y similares lo hacen) y enviar `x-forwarded-proto`.

## Comprobar el repositorio

```bash
git ls-files | grep -i "\.env"            # solo debe salir backend/.env.example
git log --all --oneline -- backend/.env   # no debe salir nada
```

Si alguna vez se subió un `.env`, quitarlo del repositorio no basta: queda en el historial. Hay que **cambiar** las claves que contenía (contraseña de la base, `JWT_SECRET`, `IA_API_KEY`, `BREVO_API_KEY`).

## Límites conocidos

- El token JWT se guarda en el navegador y dura 2 horas.
- `db.js` usa `rejectUnauthorized: false` con `DB_SSL=true`: la conexión va cifrada, pero no verifica el certificado del servidor de la base.

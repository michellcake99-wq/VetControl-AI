# VetControl AI — API de propietarios y mascotas

Base: `http://localhost:3000/api`.

Las rutas de propietarios y mascotas requieren el token obtenido mediante el login existente:

POST /api/auth/login

```json
{
  "correo": "vet@vetcontrol.com",
  "contrasena": "Vet12345"
}
→ usar el token en el header:  Authorization: Bearer <token>
```

Usuarios de `database/seed.sql` (clave `Vet12345`): `admin@vetcontrol.com` (administrador), `vet@vetcontrol.com` y `vet2@vetcontrol.com` (veterinarios), `ana@correo.com` (dueña de Max y Luna), `carlos@correo.com` (dueño de Rocky), `marta@correo.com` (dueña de Kiwi).

"Personal" = veterinario o administrador.

## Propietarios (Ep3-Hu4)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/propietarios?q=&activo=&pagina=&limite=` | personal |
| GET | `/propietarios/me` | propietario |
| POST | `/propietarios` | personal — crea la cuenta y el perfil |
| GET | `/propietarios/:id` | personal o el mismo propietario |
| PUT | `/propietarios/:id` | personal o el mismo propietario (puede completar su documento, no cambiarlo) |
| DELETE | `/propietarios/:id` | personal — desactiva cuenta y mascotas |
| GET | `/propietarios/:id/mascotas` | personal o el mismo propietario |

```json
POST /api/propietarios
{
  "nombre": "Sofía", "apellido": "Díaz",
  "correo": "sofia@correo.com", "contrasena": "Clave12345",
  "tipo_documento": "CC", "numero_documento": "1091888888",
  "telefono": "3201112244", "direccion": "Calle 5 # 3-10"
}
```

## Mascotas (Ep3-Hu4)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/mascotas?q=&especie=&id_propietario=&activo=&pagina=&limite=` | todos (el propietario solo ve las suyas) |
| POST | `/mascotas` | personal, o propietario (queda a su nombre) |
| GET | `/mascotas/:id` | todos (propietario: solo las suyas) |
| PUT | `/mascotas/:id` | todos (el propietario no puede cambiar el dueño) |
| DELETE | `/mascotas/:id` | personal — borrado lógico |

```json
POST /api/mascotas
{
  "id_propietario": 1, "nombre": "Max", "especie": "canino", "raza": "Labrador",
  "sexo": "macho", "fecha_nacimiento": "2021-03-15", "color": "Dorado",
  "peso_kg": 28.5, "esterilizado": true, "microchip": "985112003456789"
}
```

## Errores

Todas las respuestas de error usan `{"mensaje": "..."}`, igual que el login existente.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos — incluye `detalles: [{campo, mensaje}]` |
| 401 | Sin token, token inválido/expirado o cuenta desactivada |
| 403 | El rol no tiene permiso o el recurso no es del propietario |
| 404 | No existe |
| 409 | Dato único repetido (correo, documento, microchip) o conflicto de estado |

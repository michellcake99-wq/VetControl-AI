# VetControl AI — API de propietarios, mascotas, veterinarios e historias clínicas

Base: `http://localhost:3000/api`. Todas las rutas requieren el token del login existente:

```
POST /api/auth/login   {"correo": "vet@vetcontrol.com", "contrasena": "Vet12345"}
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

## Veterinarios (Ep4-Hu5)

Todo este recurso es exclusivo del **administrador** (los demás roles reciben 403).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/veterinarios?q=&especialidad=&activo=&pagina=&limite=` | lista paginada |
| POST | `/veterinarios` | crea la cuenta (rol veterinario) y su perfil |
| GET | `/veterinarios/:id` | detalle |
| PUT | `/veterinarios/:id` | edita nombre, apellido, tarjeta, especialidad o teléfono (no correo ni contraseña) |
| DELETE | `/veterinarios/:id` | desactiva la cuenta (ya no puede iniciar sesión; su historial se conserva) |
| GET | `/veterinarios/:id/horarios` | horarios de atención |
| POST | `/veterinarios/:id/horarios` | agrega un horario |
| PUT | `/veterinarios/:id/horarios/:idHorario` | modifica un horario de ese veterinario |
| DELETE | `/veterinarios/:id/horarios/:idHorario` | elimina un horario |

```json
POST /api/veterinarios
{
  "nombre": "Sofía", "apellido": "Díaz", "correo": "sofia@vetcontrol.com",
  "contrasena": "Temporal123", "tarjeta_profesional": "MV-99999",
  "especialidad": "Dermatología", "telefono": "3001234567"
}

POST /api/veterinarios/1/horarios
{ "dia_semana": 1, "hora_inicio": "08:00", "hora_fin": "12:00" }
```

`dia_semana` va de 1 (lunes) a 7 (domingo) y `hora_fin` debe ser posterior a `hora_inicio`. La tarjeta profesional y el correo no se pueden repetir (409).

## Historias clínicas (Ep3-Hu8)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/mascotas/:id/historia` | todos — historia completa + resumen |
| GET | `/historias/:id` | todos |
| PUT | `/historias/:id` | veterinario — antecedentes, alergias, enfermedades_cronicas |
| GET | `/historias/:id/consultas?desde=&hasta=&pagina=` | todos |
| POST | `/historias/:id/consultas` | veterinario |
| GET | `/consultas/:id` | todos |
| PUT | `/consultas/:id` | el veterinario que la registró |
| POST | `/consultas/:id/tratamientos` | veterinario |
| GET | `/historias/:id/tratamientos?estado=activo` | todos |
| PUT | `/tratamientos/:id` | veterinario (p. ej. `{"estado": "finalizado"}`) |
| GET | `/tratamientos/:id/evoluciones` | todos |
| POST | `/tratamientos/:id/evoluciones` | propietario dueño de la mascota |
| GET | `/historias/:id/vacunas` | todos |
| POST | `/historias/:id/vacunas` | veterinario |

"Todos" = cualquier usuario autenticado; el propietario solo accede a lo de sus mascotas.

```json
POST /api/historias/3/consultas
{
  "id_cita": 2, "motivo": "Revisión de piel", "anamnesis": "Se rasca hace una semana",
  "peso_kg": 23.1, "temperatura_c": 38.9, "frecuencia_cardiaca": 100,
  "frecuencia_respiratoria": 24, "examen_fisico": "Eritema en abdomen",
  "diagnostico": "Dermatitis alérgica", "proximo_control": "2026-12-01"
}

POST /api/consultas/1/tratamientos
{ "medicamento": "Meloxicam", "dosis": "0.1 mg/kg", "frecuencia": "cada 24 horas",
  "via": "oral", "fecha_inicio": "2026-11-10", "fecha_fin": "2026-11-20" }

POST /api/historias/1/vacunas
{ "nombre": "Rabia", "laboratorio": "Zoetis", "lote": "RB-2291",
  "fecha_aplicacion": "2026-11-10", "proxima_dosis": "2027-11-10" }

POST /api/tratamientos/1/evoluciones      (como propietario)
{ "estado_general": 4, "dosis_aplicada": true, "descripcion": "Ya no cojea" }
```

## Citas (Ep3-Hu10)

Todas las rutas exigen el token JWT. Las fechas se envían en formato ISO 8601 con zona horaria (por ejemplo `2026-11-20T10:30:00-05:00`).

| Método | Ruta | Quién |
|---|---|---|
| POST | `/citas` | propietario (solo para sus mascotas), veterinario (solo en su agenda) o administrador |
| GET | `/citas?estado=&desde=&hasta=&id_mascota=&id_veterinario=&orden=asc|desc&pagina=&limite=` | todos — el propietario ve las suyas, el veterinario su agenda y el administrador todas |
| GET | `/citas/:id` | el propietario de la mascota, el veterinario de la cita o el administrador |
| PUT o PATCH | `/citas/:id/estado` | según el cambio (ver tabla de estados) |

```json
POST /api/citas
{ "id_mascota": 1, "id_veterinario": 1, "fecha_hora": "2026-11-20T10:30:00-05:00",
  "duracion_min": 30, "motivo": "Vacuna anual" }

PUT /api/citas/5/estado
{ "estado": "atendida", "observaciones": "Sin novedades" }
```

`duracion_min` es opcional (por defecto 30; entre 10 y 240). La cita nace con estado `programada` (la «solicitada» de los criterios de la historia).

Reglas de la creación:

- No se permiten fechas u horas pasadas (`400`).
- Un veterinario no puede tener dos citas activas (`programada` o `reprogramada`) que se crucen en el tiempo: responde `409` con el mensaje «El veterinario ya tiene una cita en ese horario (ocupado de 10:00 a 10:30). Elija otra hora.». Una cita cancelada libera el horario.
- El propietario que agenda para la mascota de otra persona recibe `403`; mascota inexistente `404`; veterinario inexistente o desactivado `400`.

Estados (los del tipo `estado_cita` de la base de datos: `programada`, `reprogramada`, `cancelada`, `atendida`, `no_asistio`). Equivalencias con los criterios: «solicitada» = `programada` y «completada» = `atendida`. No existe un estado «confirmada».

Cambios de estado permitidos (cualquier otro responde `409`; si el estado es válido pero el rol no puede hacerlo, `403`):

| Estado actual | Nuevo estado | Quién |
|---|---|---|
| `programada` o `reprogramada` | `atendida` | veterinario de la cita o administrador |
| `programada` o `reprogramada` | `no_asistio` | veterinario de la cita o administrador |
| `programada` o `reprogramada` | `cancelada` | propietario de la mascota, veterinario de la cita o administrador |

`atendida`, `cancelada` y `no_asistio` son estados finales. Al registrar una consulta asociada a una cita (`POST /historias/:id/consultas` con `id_cita`), la cita pasa automáticamente a `atendida`.

## Consultas y tratamientos por mascota (Ep3-Hu9)

Además de las rutas por historia clínica de arriba:

| Método | Ruta | Quién |
|---|---|---|
| GET | `/mascotas/:id/consultas?desde=&hasta=&pagina=&limite=` | todos (el propietario solo las de sus mascotas) |
| GET | `/mascotas/:id/tratamientos?estado=activo|finalizado|suspendido` | todos (el propietario solo las de sus mascotas) |

Las consultas se listan de la más reciente a la más antigua e incluyen `nombre_veterinario` y `total_tratamientos`; los tratamientos incluyen `fecha_consulta` y `diagnostico`. Solo el veterinario crea o modifica consultas y tratamientos; el propietario únicamente consulta los de sus mascotas.

La colección de Postman para probar estas rutas está en `docs/VetControl-AI.postman_collection.json`.

## Errores

Todas las respuestas de error usan `{"mensaje": "..."}`, igual que el login existente.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos — incluye `detalles: [{campo, mensaje}]` |
| 401 | Sin token, token inválido/expirado o cuenta desactivada |
| 403 | El rol no tiene permiso o el recurso no es del propietario |
| 404 | No existe |
| 409 | Dato único repetido (correo, documento, microchip) o conflicto de estado |

# VetControl AI — API de propietarios, mascotas e historias clínicas

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

## Errores

Todas las respuestas de error usan `{"mensaje": "..."}`, igual que el login existente.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos — incluye `detalles: [{campo, mensaje}]` |
| 401 | Sin token, token inválido/expirado o cuenta desactivada |
| 403 | El rol no tiene permiso o el recurso no es del propietario |
| 404 | No existe |
| 409 | Dato único repetido (correo, documento, microchip) o conflicto de estado |

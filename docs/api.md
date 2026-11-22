# VetControl AI — Documentación de la API

Base: `http://localhost:3000/api`. Todas las rutas requieren el token del login existente:

```
POST /api/auth/login   {"correo": "vet@vetcontrol.com", "contrasena": "Vet12345"}
→ usar el token en el header:  Authorization: Bearer <token>
```

### Sesión y seguridad del inicio de sesión (Ep7-Hu3)

- El token JWT dura **2 horas**. Con el token vencido las rutas responden `401` con `{ "mensaje": "Tu sesión expiró. Inicia sesión de nuevo para continuar.", "codigo": "sesion_expirada" }`; la interfaz cierra la sesión y lleva al inicio de sesión con ese mensaje. «Cerrar sesión» borra el token y vuelve a la página principal.
- Una cuenta desactivada no puede iniciar sesión (`403`) y su token deja de servir (`401`).
- **Bloqueo:** tras **5 intentos fallidos en 15 minutos** (contraseña incorrecta o correo inexistente) el login de ese correo responde `429` con `{ "codigo": "cuenta_bloqueada", "reintentar_en_minutos": N }` durante 15 minutos, incluso con la contraseña correcta. Un inicio de sesión correcto borra los intentos. Los intentos se guardan en la tabla `intentos_login` (migración `008`).

### Recuperación de contraseña (Ep7-Hu4)

Rutas públicas (no necesitan token):

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/olvide-contrasena` | `{ "correo": "..." }` — envía un enlace por correo. Responde **siempre lo mismo** exista o no el correo (y no envía a cuentas desactivadas). Máximo 5 solicitudes por hora por cuenta; un enlace nuevo anula el anterior |
| POST | `/auth/verificar-token-recuperacion` | `{ "token": "..." }` — `200` si el enlace sirve; `400` si ya se usó, venció o no existe |
| POST | `/auth/restablecer-contrasena` | `{ "token", "contrasena", "confirmacion" }` — mínimo 8 caracteres y deben coincidir. El token es de **un solo uso**, vale **1 hora** y en la base solo se guarda su hash SHA-256 (tabla `tokens_recuperacion`, migración `009`). Al cambiar la contraseña también se quita el bloqueo por intentos fallidos |

El enlace del correo apunta a `FRONTEND_URL/restablecer-contrasena?token=...`. Variables del `.env`: `FRONTEND_URL` (por defecto `http://localhost:5173`) y las del correo (`BREVO_API_KEY`, `CORREO_REMITENTE`). Sin correo configurado y fuera de producción, el enlace se escribe en la consola del servidor para poder probar.

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
| GET | `/consultas?q=&id_mascota=&desde=&hasta=&pagina=&limite=` | todos — módulo Consultas (Ep3-Hu13); el propietario solo ve las de sus mascotas |
| GET | `/consultas/:id` | todos — incluye mascota, propietario, tratamientos y `puede_editar` |
| PUT | `/consultas/:id` | el veterinario que la registró |
| POST | `/consultas/:id/tratamientos` | veterinario |
| GET | `/historias/:id/tratamientos?estado=activo` | todos |
| PUT | `/tratamientos/:id` | veterinario (p. ej. `{"estado": "finalizado"}`) |
| GET | `/tratamientos/:id/evoluciones` | todos |
| POST | `/tratamientos/:id/evoluciones` | propietario dueño de la mascota |
| GET | `/historias/:id/vacunas` | todos (carné en orden cronológico) |
| POST | `/historias/:id/vacunas` | veterinario (ver Ep4-Hu1) |

"Todos" = cualquier usuario autenticado; el propietario solo accede a lo de sus mascotas.

Examen clínico completo (migración `004`): `actitud` ∈ `alerta | letargico | estuporoso | comatoso | otro` (con `actitud_otro`). `organos_sistemas` admite las claves `estado_general, hidratacion, tegumentario, ojos, oidos, nariz, digestivo, respiratorio, nervioso, musculoesqueletico, cardiovascular, genitourinario`, cada una con `N` (normal), `AN` (anormal) o `NE` (no examinado).

```json
POST /api/historias/3/consultas
{
  "id_cita": 2, "motivo": "Revisión de piel", "anamnesis": "Se rasca hace una semana",
  "peso_kg": 23.1, "temperatura_c": 38.9, "frecuencia_cardiaca": 100,
  "frecuencia_respiratoria": 24, "examen_fisico": "Eritema en abdomen",
  "diagnostico": "Dermatitis alérgica", "proximo_control": "2026-12-01",
  "pulso": 98, "tiempo_llenado_capilar": 2, "ganglios_linfaticos": "Normales",
  "mucosas": "Rosadas", "actitud": "alerta",
  "organos_sistemas": { "estado_general": "N", "digestivo": "AN", "ojos": "NE" }
}

POST /api/consultas/1/tratamientos
{ "medicamento": "Meloxicam", "dosis": "0.1 mg/kg", "frecuencia": "cada 24 horas",
  "via": "oral", "fecha_inicio": "2026-11-10", "fecha_fin": "2026-11-20" }

POST /api/tratamientos/1/evoluciones      (como propietario)
{ "estado_general": 4, "dosis_aplicada": true, "descripcion": "Ya no cojea" }
```

## Vacunas (Ep4-Hu1)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/vacunas/catalogo?especie=felino` | todos — vacunas disponibles (las de esa especie + las que aplican a todas) |
| GET | `/historias/:id/vacunas` | todos — carné en orden cronológico; el propietario solo el de sus mascotas |
| POST | `/historias/:id/vacunas` | veterinario — registra una vacuna |
| PUT | `/vacunas/:id` | veterinario — corrige un registro ingresado por error |

```json
POST /api/historias/2/vacunas
{
  "id_catalogo": 8, "laboratorio": "Zoetis", "lote": "FL-001",
  "fecha_aplicacion": "2026-11-10", "proxima_dosis": "2027-11-10",
  "observaciones": "Sin reacciones"
}

PUT /api/vacunas/4
{ "lote": "FL-002", "proxima_dosis": "2027-12-01" }
```

- La vacuna se elige del catálogo con `id_catalogo` (el nombre se toma del catálogo). Para una vacuna que no esté en el catálogo se envía `nombre` sin `id_catalogo`.
- La vacuna del catálogo debe servir para la especie de la mascota (si no, `400` en el campo `id_catalogo`).
- `proxima_dosis` debe ser posterior a `fecha_aplicacion`, y la aplicación no puede ser futura (`400` en el campo correspondiente). Al corregir se valida con las fechas finales (las nuevas + las ya guardadas).
- Cada vacuna del carné incluye `nombre_veterinario` y `dias_refuerzo` (sugerencia del catálogo para la próxima dosis).
- **Bases que ya tienen datos (Supabase):** ejecutar `database/migraciones/001_ep4-hu1_catalogo_vacunas.sql`. No borra nada y se puede ejecutar más de una vez.

## Citas (Ep3-Hu10)

Todas las rutas exigen el token JWT. Las fechas se envían en formato ISO 8601 con zona horaria (por ejemplo `2026-11-20T10:30:00-05:00`).

| Método | Ruta | Quién |
|---|---|---|
| POST | `/citas` | propietario (solo para sus mascotas), veterinario (solo en su agenda) o administrador |
| GET | `/citas?estado=&desde=&hasta=&id_mascota=&id_veterinario=&orden=asc|desc&pagina=&limite=` | todos — el propietario ve las suyas, el veterinario su agenda y el administrador todas |
| GET | `/citas/:id` | el propietario de la mascota, el veterinario de la cita o el administrador |
| PUT o PATCH | `/citas/:id/estado` | según el cambio (ver tabla de estados) |
| GET | `/citas/veterinarios` | todos — veterinarios activos para elegir al pedir la cita (Ep3-Hu14) |
| GET | `/citas/ocupados?id_veterinario=&fecha=AAAA-MM-DD` | todos — horarios ya tomados de ese veterinario ese día, sin datos de otras personas (Ep3-Hu14) |

```json
POST /api/citas
{ "id_mascota": 1, "id_veterinario": 1, "fecha_hora": "2026-11-20T10:30:00-05:00",
  "duracion_min": 30, "motivo": "Vacuna anual", "tipo_consulta": "vacunacion" }

PUT /api/citas/5/estado
{ "estado": "atendida", "observaciones": "Sin novedades" }
```

`duracion_min` es opcional (por defecto 30; entre 10 y 240). `tipo_consulta` es opcional (por defecto `consulta_general`; migración `006`): `consulta_general`, `vacunacion`, `control`, `desparasitacion`, `cirugia`, `urgencia` u `otro`.

La cita que pide el propietario nace con estado `programada` (la «solicitada» de los criterios de la historia) y espera la confirmación del veterinario. La que agenda el veterinario (en su propia agenda) o el administrador nace ya `confirmada`.

Reglas de la creación:

- No se permiten fechas u horas pasadas (`400`).
- Un veterinario no puede tener dos citas activas (`programada`, `confirmada` o `reprogramada`) que se crucen en el tiempo: responde `409` con el mensaje «El veterinario ya tiene una cita en ese horario (ocupado de 10:00 a 10:30). Elija otra hora.». Una cita cancelada libera el horario.
- El propietario que agenda para la mascota de otra persona recibe `403`; mascota inexistente `404`; veterinario inexistente o desactivado `400`.

Estados (los del tipo `estado_cita` de la base de datos: `programada`, `confirmada`, `reprogramada`, `cancelada`, `atendida`, `no_asistio`). Equivalencias con los criterios: «solicitada» = `programada` y «completada» = `atendida`. El estado `confirmada` se agregó en Ep3-Hu14 (migración `005`).

Cambios de estado permitidos (cualquier otro responde `409`; si el estado es válido pero el rol no puede hacerlo, `403`):

| Estado actual | Nuevo estado | Quién |
|---|---|---|
| `programada` o `reprogramada` | `confirmada` | veterinario de la cita o administrador |
| `confirmada` | `atendida` (completada) | veterinario de la cita o administrador |
| `confirmada` | `no_asistio` | veterinario de la cita o administrador |
| `programada`, `confirmada` o `reprogramada` | `cancelada` | propietario de la mascota, veterinario de la cita o administrador |

Una cita solicitada (`programada`) no puede pasar directo a `atendida`: primero se confirma (Ep5-Hu6). `atendida`, `cancelada` y `no_asistio` son estados finales. Cada cambio genera un aviso en la campana (y por correo): si lo hace el personal, le llega al propietario («Cita confirmada», «Cita cancelada», «Cita completada»); si el propietario cancela, le llega al veterinario. En la interfaz, al completar una cita el veterinario puede registrar de una vez su consulta (`/consultas/nueva?mascota=ID&cita=ID`). Al registrar una consulta asociada a una cita (`POST /historias/:id/consultas` con `id_cita`), la cita pasa automáticamente a `atendida`.

## Consultas y tratamientos por mascota (Ep3-Hu9)

Además de las rutas por historia clínica de arriba:

| Método | Ruta | Quién |
|---|---|---|
| GET | `/mascotas/:id/consultas?desde=&hasta=&pagina=&limite=` | todos (el propietario solo las de sus mascotas) |
| GET | `/mascotas/:id/tratamientos?estado=activo|finalizado|suspendido` | todos (el propietario solo las de sus mascotas) |

Las consultas se listan de la más reciente a la más antigua e incluyen `nombre_veterinario` y `total_tratamientos`; los tratamientos incluyen `fecha_consulta` y `diagnostico`. Solo el veterinario crea o modifica consultas y tratamientos; el propietario únicamente consulta los de sus mascotas.

La colección de Postman para probar estas rutas está en `docs/VetControl-AI.postman_collection.json`.

## Asistente de IA (Ep6-Hu1)

| Método | Ruta | Quién |
|---|---|---|
| POST | `/ia/resumir-historial` | todos (con token) — `{ "id_mascota": 1 }`; el propietario solo para sus mascotas. Resume antecedentes, diagnósticos recientes, tratamientos activos y vacunas usando solo los datos de esa mascota. Responde `{ respuesta, aviso, modelo, fecha, consultas_restantes }`; `aviso` es el texto que indica que lo generó una IA. Cuenta para el límite de consultas y queda en `interacciones_ia` (Ep6-Hu2) |
| POST | `/ia/consultar` | todos (con token). Con `id_mascota`, el propietario solo puede preguntar por las suyas |

```json
POST /api/ia/consultar
{ "pregunta": "¿Cada cuánto debo desparasitar a mi perro?", "id_mascota": 1 }

200 OK
{
  "id_interaccion": 12,
  "respuesta": "En general se recomienda…",
  "modelo": "openai/gpt-oss-120b",
  "fecha": "2026-11-14T20:15:03.120Z",
  "consultas_restantes": 19
}
```

- `id_mascota` es opcional. Si se envía, la IA recibe como contexto **solo** los datos de esa mascota (antecedentes, últimas consultas, tratamientos activos y vacunas).
- Cada consulta, exitosa o fallida, se guarda en la tabla `interacciones_ia` (usuario, mascota, pregunta, respuesta, modelo, fecha y error si lo hubo).
- **Límite por usuario:** `IA_LIMITE_CONSULTAS` consultas cada `IA_VENTANA_MINUTOS` minutos (por defecto 20 cada 60). Al pasarlo responde `429` indicando cuánto falta para volver a consultar.
- **Errores del servicio** (el servidor nunca se detiene): `502` si el proveedor falla o no responde bien, `503` si está saturado o falta configurar la clave, `504` si tarda más de `IA_TIEMPO_MAXIMO_MS`.
- **Configuración:** la clave va en `IA_API_KEY` del `.env` (ver `backend/.env.example`), nunca en el código. Por defecto usa Groq, que es gratuito y sin tarjeta; cualquier proveedor compatible con OpenAI sirve cambiando `IA_URL_BASE` e `IA_MODELO`.
- **Bases que ya tienen datos (Supabase):** ejecutar `database/migraciones/002_ep6-hu1_interacciones_ia.sql`.

## Errores

Todas las respuestas de error usan `{"mensaje": "..."}`, igual que el login existente.

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos — incluye `detalles: [{campo, mensaje}]` |
| 401 | Sin token, token inválido/expirado o cuenta desactivada |
| 403 | El rol no tiene permiso o el recurso no es del propietario |
| 404 | No existe |
| 409 | Dato único repetido (correo, documento, microchip) o conflicto de estado |

## Chat (Ep8-Hu1 y Ep8-Hu5)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/conversaciones/veterinarios` | propietario — veterinarios activos a los que puede escribir |
| GET | `/conversaciones` | propietario o veterinario — sus conversaciones |
| POST | `/conversaciones` | propietario — `{ "id_veterinario": 1, "id_mascota": 1 }` (mascota opcional) |
| GET | `/conversaciones/:id/mensajes` | solo los dos participantes |

Los mensajes se envían por Socket.IO: `io({ auth: { token } })` y el evento `enviar_mensaje` `{ id_conversacion, contenido }`, que responde `{ mensaje }` o `{ error, estado }`.

Restricciones según el rol (Ep8-Hu5):

- El chat es solo entre un propietario y un veterinario: el administrador recibe `403` en todas las rutas y no puede conectarse al socket; un veterinario no puede iniciar conversaciones ni escribirle a otro veterinario.
- Un propietario solo puede escribirle a veterinarios activos (y un veterinario solo a propietarios activos).
- Solo los participantes de una conversación pueden leer y enviar mensajes en ella.
- Los intentos no permitidos se rechazan con `403` (`estado: 403` en el socket) y el mensaje **no** se guarda.
- El servidor de Socket.IO vuelve a validar el usuario (cuenta activa) y su rol en cada evento, no solo al conectarse.

## Notificaciones y recordatorios (Ep5-Hu1)

Todas las rutas exigen token; cada usuario solo ve y marca las suyas.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notificaciones?solo_no_leidas=true&pagina=&limite=` | Bandeja del usuario (más recientes primero). Una notificación aparece cuando llega su hora; las canceladas no se muestran |
| GET | `/notificaciones/no-leidas` | `{ "no_leidas": 3 }` — número que muestra la campana |
| PATCH | `/notificaciones/:id/leida` | Marca una como leída (`404` si no es del usuario) |
| POST | `/notificaciones/marcar-leidas` | Marca todas como leídas |

Cuándo se generan:

- Cita **confirmada** → recordatorio al propietario 24 h antes (si falta menos, sale de inmediato). Si la cita se cancela o cambia de fecha, el recordatorio pendiente se cancela o se reprograma. No se crea dos veces el mismo recordatorio.
- Cita **solicitada** por un propietario → aviso al veterinario.
- Vacuna registrada con `proxima_dosis` (Ep5-Hu2) → recordatorio al propietario 7 días antes, a las 8:00 a. m. (hora de la clínica), con el nombre de la mascota, la vacuna y la fecha; si faltan menos de 7 días sale de inmediato. Si la fecha se corrige (`PUT /vacunas/:id`) el recordatorio se actualiza o, si se quita la fecha, se cancela. Cuando se registra una nueva aplicación de la misma vacuna para esa mascota (la dosis ya se aplicó), o la fecha ya pasó, no se recuerda más.
- Tratamiento **activo** (Ep5-Hu3) → recordatorio al propietario en cada dosis, con mascota, medicamento, dosis y hora. Las dosis se cuentan desde las 8:00 a. m. del día de inicio según la frecuencia escrita («cada 8 horas», «3 veces al día», «diaria», «cada 2 días», «semanal»; si no se entiende se recuerda una vez al día). Solo se avisa la dosis más reciente y nunca dos veces la misma. No se generan recordatorios si el tratamiento está finalizado o suspendido (`PUT /tratamientos/:id` cancela los pendientes), si aún no empieza o si `fecha_fin` ya pasó.
- Cada minuto el servidor envía por correo (Brevo) los recordatorios que ya llegaron a su hora. Variables del `.env`: `BREVO_API_KEY`, `CORREO_REMITENTE` y, opcional, `CORREO_NOMBRE`. Sin esas variables las notificaciones siguen apareciendo en la plataforma, pero no se envía correo.
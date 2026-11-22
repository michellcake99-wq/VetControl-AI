-- =====================================================================
--  VetControl AI - Modelo de datos (Ep3-Hu5)
--  Motor: PostgreSQL 14+   ·   Base de datos: vetcontrol_ai
--
--  Cómo ejecutarlo en pgAdmin:
--    clic derecho en vetcontrol_ai > Query Tool > abrir este archivo > Ejecutar (F5)
--
--  ATENCIÓN: el script BORRA y vuelve a crear todas las tablas (incluidas
--  roles y usuarios). Los usuarios registrados antes se pierden.
--
--  Convenciones: tablas en plural, llave primaria id_<entidad>, llaves
--  foráneas con el mismo nombre de la llave que referencian, auditoría con
--  fecha_registro / fecha_actualizacion.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS interacciones_ia, auditoria, horarios_veterinario, mensajes, conversaciones, recordatorios,
  evoluciones_tratamiento, tratamientos, vacunas, catalogo_vacunas, consultas, historias_clinicas, citas, mascotas,
  veterinarios, propietarios, usuarios, roles CASCADE;
DROP TYPE IF EXISTS sexo_mascota, estado_cita, estado_tratamiento,
  tipo_recordatorio, estado_recordatorio CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_fecha, fn_crear_perfil, fn_crear_historia,
  fn_validar_traslape_horario, fn_auditar CASCADE;

-- ---------------------------------------------------------------------
--  Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE sexo_mascota        AS ENUM ('macho', 'hembra', 'desconocido');
CREATE TYPE estado_cita         AS ENUM ('programada', 'confirmada', 'reprogramada', 'cancelada', 'atendida', 'no_asistio');
CREATE TYPE estado_tratamiento  AS ENUM ('activo', 'finalizado', 'suspendido');
-- 'aviso' = notificación inmediata (Ep5-Hu1), p. ej. «nueva cita solicitada»
CREATE TYPE tipo_recordatorio   AS ENUM ('cita', 'vacuna', 'tratamiento', 'seguimiento', 'aviso');
CREATE TYPE estado_recordatorio AS ENUM ('pendiente', 'enviado', 'fallido', 'cancelado');

-- ---------------------------------------------------------------------
--  Roles y usuarios  (compatibles con backend/routes/auth.js)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id_rol       SMALLSERIAL PRIMARY KEY,
  nombre       VARCHAR(30) NOT NULL UNIQUE,
  descripcion  VARCHAR(150)
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('administrador', 'Administra la plataforma; no se puede crear desde el registro público'),
  ('veterinario',   'Personal veterinario: gestiona pacientes, historias clínicas, citas y vacunas'),
  ('propietario',   'Dueño de mascota: consulta la información de sus mascotas y registra su evolución');

CREATE TABLE usuarios (
  id_usuario           SERIAL PRIMARY KEY,
  id_rol               SMALLINT     NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
  nombre               VARCHAR(80)  NOT NULL,
  apellido             VARCHAR(80)  NOT NULL,
  correo               VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash      VARCHAR(255) NOT NULL,
  activo               BOOLEAN      NOT NULL DEFAULT TRUE,
  fecha_registro       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Perfil del propietario: solo datos que NO están en usuarios (3FN).
-- Nombre, apellido, correo y estado activo se toman de usuarios.
CREATE TABLE propietarios (
  id_propietario       SERIAL PRIMARY KEY,
  id_usuario           INT NOT NULL UNIQUE REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  tipo_documento       VARCHAR(5)  NOT NULL DEFAULT 'CC' CHECK (tipo_documento IN ('CC','CE','TI','PA','NIT')),
  numero_documento     VARCHAR(20) UNIQUE,      -- se completa después del registro
  telefono             VARCHAR(20),
  direccion            VARCHAR(150),
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE veterinarios (
  id_veterinario       SERIAL PRIMARY KEY,
  id_usuario           INT NOT NULL UNIQUE REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  tarjeta_profesional  VARCHAR(30) UNIQUE,      -- se completa después del registro
  especialidad         VARCHAR(80),
  telefono             VARCHAR(20),
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Horarios de atención del veterinario (uno o varios bloques por día)
CREATE TABLE horarios_veterinario (
  id_horario      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_veterinario  INT NOT NULL REFERENCES veterinarios(id_veterinario) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),   -- 1 = lunes ... 7 = domingo
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  CONSTRAINT uq_horario UNIQUE (id_veterinario, dia_semana, hora_inicio),
  CONSTRAINT ck_horario_rango CHECK (hora_fin > hora_inicio)
);

-- ---------------------------------------------------------------------
--  Mascotas
-- ---------------------------------------------------------------------
CREATE TABLE mascotas (
  id_mascota           SERIAL PRIMARY KEY,
  id_propietario       INT NOT NULL REFERENCES propietarios(id_propietario) ON DELETE RESTRICT,
  nombre               VARCHAR(60)  NOT NULL,
  especie              VARCHAR(40)  NOT NULL,              -- canino, felino, ave...
  raza                 VARCHAR(60),
  sexo                 sexo_mascota NOT NULL DEFAULT 'desconocido',
  fecha_nacimiento     DATE CHECK (fecha_nacimiento <= CURRENT_DATE),
  color                VARCHAR(40),
  peso_kg              NUMERIC(6,2) CHECK (peso_kg > 0),   -- peso actual
  esterilizado         BOOLEAN NOT NULL DEFAULT FALSE,
  microchip            VARCHAR(30) UNIQUE,
  observaciones        TEXT,
  -- Foto de la mascota como "data URL" (imagen JPEG/PNG/WebP ya reducida en el navegador)
  foto                 TEXT CHECK (foto IS NULL OR length(foto) <= 500000),
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mascotas_propietario ON mascotas(id_propietario);
CREATE INDEX idx_mascotas_especie     ON mascotas(especie);

-- ---------------------------------------------------------------------
--  Citas
-- ---------------------------------------------------------------------
CREATE TABLE citas (
  id_cita              SERIAL PRIMARY KEY,
  id_mascota           INT NOT NULL REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
  id_veterinario       INT NOT NULL REFERENCES veterinarios(id_veterinario) ON DELETE RESTRICT,
  fecha_hora           TIMESTAMPTZ NOT NULL,
  duracion_min         SMALLINT NOT NULL DEFAULT 30 CHECK (duracion_min BETWEEN 10 AND 240),
  motivo               VARCHAR(200) NOT NULL,
  tipo_consulta        VARCHAR(30)  NOT NULL DEFAULT 'consulta_general'
                       CONSTRAINT citas_tipo_consulta_check CHECK (tipo_consulta IN
                       ('consulta_general', 'vacunacion', 'control', 'desparasitacion',
                        'cirugia', 'urgencia', 'otro')),
  estado               estado_cita NOT NULL DEFAULT 'programada',
  observaciones        TEXT,
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_citas_fecha       ON citas(fecha_hora);
CREATE INDEX idx_citas_veterinario ON citas(id_veterinario, fecha_hora);

-- ---------------------------------------------------------------------
--  Historia clínica (1 por mascota) y sus componentes
-- ---------------------------------------------------------------------
CREATE TABLE historias_clinicas (
  id_historia            SERIAL PRIMARY KEY,
  id_mascota             INT NOT NULL UNIQUE REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
  numero                 VARCHAR(20) NOT NULL UNIQUE,     -- HC-000001
  fecha_apertura         DATE NOT NULL DEFAULT CURRENT_DATE,
  antecedentes           TEXT,
  alergias               TEXT,
  enfermedades_cronicas  TEXT,
  fecha_registro         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consultas (
  id_consulta              SERIAL PRIMARY KEY,
  id_historia              INT NOT NULL REFERENCES historias_clinicas(id_historia) ON DELETE CASCADE,
  id_veterinario           INT NOT NULL REFERENCES veterinarios(id_veterinario) ON DELETE RESTRICT,
  id_cita                  INT UNIQUE REFERENCES citas(id_cita) ON DELETE SET NULL,
  fecha                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo                   VARCHAR(200) NOT NULL,
  anamnesis                TEXT,
  peso_kg                  NUMERIC(6,2) CHECK (peso_kg > 0),         -- peso medido ese día
  temperatura_c            NUMERIC(4,1) CHECK (temperatura_c BETWEEN 30 AND 45),
  frecuencia_cardiaca      SMALLINT CHECK (frecuencia_cardiaca > 0),
  frecuencia_respiratoria  SMALLINT CHECK (frecuencia_respiratoria > 0),
  -- Examen clínico completo (formato de historia clínica)
  pulso                    SMALLINT CHECK (pulso > 0),
  tiempo_llenado_capilar   NUMERIC(3,1) CHECK (tiempo_llenado_capilar > 0),   -- segundos
  ganglios_linfaticos      VARCHAR(300),
  mucosas                  VARCHAR(200),
  actitud                  VARCHAR(20) CHECK (actitud IN ('alerta','letargico','estuporoso','comatoso','otro')),
  actitud_otro             VARCHAR(100),
  -- Órganos y sistemas: {"ojos": "N", "oidos": "AN", ...}  N = normal, AN = anormal, NE = no examinado
  organos_sistemas         JSONB,
  examen_fisico            TEXT,
  diagnostico              TEXT NOT NULL,
  observaciones            TEXT,
  proximo_control          DATE,
  fecha_registro           TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consultas_historia ON consultas(id_historia, fecha DESC);

CREATE TABLE tratamientos (
  id_tratamiento       SERIAL PRIMARY KEY,
  id_consulta          INT NOT NULL REFERENCES consultas(id_consulta) ON DELETE CASCADE,
  medicamento          VARCHAR(120) NOT NULL,
  dosis                VARCHAR(60)  NOT NULL,
  frecuencia           VARCHAR(60)  NOT NULL,           -- "cada 8 horas"
  via                  VARCHAR(30),                     -- oral, tópica, IM...
  fecha_inicio         DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin            DATE,
  indicaciones         TEXT,
  estado               estado_tratamiento NOT NULL DEFAULT 'activo',
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_tratamientos_consulta ON tratamientos(id_consulta);

-- Evolución del tratamiento registrada por el PROPIETARIO entre consultas
CREATE TABLE evoluciones_tratamiento (
  id_evolucion     SERIAL PRIMARY KEY,
  id_tratamiento   INT NOT NULL REFERENCES tratamientos(id_tratamiento) ON DELETE CASCADE,
  id_usuario       INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT, -- quién lo registró
  fecha            TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado_general   SMALLINT NOT NULL CHECK (estado_general BETWEEN 1 AND 5), -- 1 muy mal ... 5 muy bien
  dosis_aplicada   BOOLEAN NOT NULL DEFAULT TRUE,
  descripcion      TEXT NOT NULL,
  fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evoluciones_tratamiento ON evoluciones_tratamiento(id_tratamiento, fecha DESC);

-- Ep4-Hu1: catálogo de vacunas disponibles en la clínica.
-- especie NULL = la vacuna aplica a cualquier especie.
-- dias_refuerzo = sugerencia para calcular la próxima dosis (el veterinario puede cambiarla).
CREATE TABLE catalogo_vacunas (
  id_catalogo          SERIAL PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL UNIQUE,
  especie              VARCHAR(40),
  descripcion          VARCHAR(300),
  dias_refuerzo        SMALLINT CHECK (dias_refuerzo > 0),
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalogo_vacunas (nombre, especie, descripcion, dias_refuerzo) VALUES
  ('Rabia',                  NULL,     'Obligatoria en perros y gatos',                                365),
  ('Pentavalente canina',    'canino', 'Moquillo, hepatitis, parvovirus, parainfluenza y leptospirosis', 365),
  ('Parvovirus canino',      'canino', 'Refuerzo específico contra parvovirus',                      365),
  ('Moquillo canino',        'canino', 'Refuerzo específico contra moquillo',                        365),
  ('Leptospirosis',          'canino', 'Protección contra leptospira',                               365),
  ('Tos de las perreras',    'canino', 'Bordetella bronchiseptica',                                  365),
  ('Triple felina',          'felino', 'Rinotraqueítis, calicivirus y panleucopenia',                 365),
  ('Leucemia felina',        'felino', 'Virus de la leucemia felina (FeLV)',                          365);

CREATE TABLE vacunas (
  id_vacuna            SERIAL PRIMARY KEY,
  id_historia          INT NOT NULL REFERENCES historias_clinicas(id_historia) ON DELETE CASCADE,
  id_veterinario       INT REFERENCES veterinarios(id_veterinario) ON DELETE SET NULL,
  id_catalogo          INT REFERENCES catalogo_vacunas(id_catalogo) ON DELETE SET NULL,
  nombre               VARCHAR(100) NOT NULL,
  laboratorio          VARCHAR(100),
  lote                 VARCHAR(50),
  fecha_aplicacion     DATE NOT NULL,
  proxima_dosis        DATE,
  observaciones        TEXT,
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (proxima_dosis IS NULL OR proxima_dosis > fecha_aplicacion)
);
CREATE INDEX idx_vacunas_historia      ON vacunas(id_historia);
CREATE INDEX idx_vacunas_proxima_dosis ON vacunas(proxima_dosis);

-- ---------------------------------------------------------------------
--  Recordatorios (citas, vacunas, tratamientos, seguimientos de la IA)
-- ---------------------------------------------------------------------
CREATE TABLE recordatorios (
  id_recordatorio   SERIAL PRIMARY KEY,
  id_usuario        INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,  -- destinatario
  id_mascota        INT REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
  tipo              tipo_recordatorio NOT NULL,
  id_referencia     INT,               -- id de la cita / vacuna / tratamiento
  mensaje           VARCHAR(300) NOT NULL,
  fecha_programada  TIMESTAMPTZ NOT NULL,
  canal             VARCHAR(10) NOT NULL DEFAULT 'email' CHECK (canal IN ('email','push')),
  estado            estado_recordatorio NOT NULL DEFAULT 'pendiente',
  generado_por_ia   BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_registro    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ep5-Hu1: la tabla es también la bandeja de notificaciones (campana) y la cola de correos
  titulo            VARCHAR(120),
  enlace            VARCHAR(200),          -- a dónde lleva la notificación al tocarla
  fecha_evento      TIMESTAMPTZ,           -- fecha de la cita / dosis recordada
  leido             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_lectura     TIMESTAMPTZ,
  fecha_envio       TIMESTAMPTZ            -- cuándo se envió el correo
);
CREATE INDEX idx_recordatorios_pendientes ON recordatorios(fecha_programada) WHERE estado = 'pendiente';
CREATE INDEX idx_recordatorios_usuario ON recordatorios(id_usuario, fecha_programada DESC);
-- Un mismo recordatorio (usuario + tipo + referencia + fecha del evento) no se repite
CREATE UNIQUE INDEX uq_recordatorios_evento ON recordatorios(id_usuario, tipo, id_referencia, fecha_evento)
  WHERE fecha_evento IS NOT NULL AND estado <> 'cancelado';

-- ---------------------------------------------------------------------
--  Chat veterinario <-> propietario (Socket.IO)
-- ---------------------------------------------------------------------
CREATE TABLE conversaciones (
  id_conversacion  SERIAL PRIMARY KEY,
  id_propietario   INT NOT NULL REFERENCES propietarios(id_propietario) ON DELETE CASCADE,
  id_veterinario   INT NOT NULL REFERENCES veterinarios(id_veterinario) ON DELETE CASCADE,
  id_mascota       INT REFERENCES mascotas(id_mascota) ON DELETE SET NULL,
  fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_propietario, id_veterinario, id_mascota)
);

CREATE TABLE mensajes (
  id_mensaje       SERIAL PRIMARY KEY,
  id_conversacion  INT NOT NULL REFERENCES conversaciones(id_conversacion) ON DELETE CASCADE,
  id_remitente     INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
  contenido        TEXT NOT NULL CHECK (length(trim(contenido)) > 0),
  leido            BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_envio      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensajes_conversacion ON mensajes(id_conversacion, fecha_envio);

-- ---------------------------------------------------------------------
--  Auditoría de cambios en la información clínica
--  id_usuario = usuario de la APLICACIÓN que hizo el cambio (lo envía la API
--  con set_config('app.id_usuario', ...)); NULL si el cambio se hizo
--  directamente en pgAdmin.
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id_auditoria    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  accion          VARCHAR(20) NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  tabla_afectada  VARCHAR(60) NOT NULL,
  id_registro     VARCHAR(40) NOT NULL,
  detalle         JSONB,           -- {"antes": {...}, "despues": {...}}
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_auditoria_fecha    ON auditoria (fecha DESC);
CREATE INDEX ix_auditoria_registro ON auditoria (tabla_afectada, id_registro);

-- ---------------------------------------------------------------------
--  Ep6-Hu1: interacciones con el asistente de IA
--  Se guardan todas (también las fallidas): sirven de historial y para
--  limitar cuántas consultas hace cada usuario en un periodo de tiempo.
-- ---------------------------------------------------------------------
CREATE TABLE interacciones_ia (
  id_interaccion  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_mascota      INT REFERENCES mascotas(id_mascota) ON DELETE SET NULL,
  pregunta        TEXT NOT NULL,
  respuesta       TEXT,
  modelo          VARCHAR(80),
  exitosa         BOOLEAN NOT NULL DEFAULT FALSE,
  error           VARCHAR(300),
  duracion_ms     INT,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_interacciones_ia_usuario_fecha ON interacciones_ia (id_usuario, fecha DESC);

-- ---------------------------------------------------------------------
--  Trigger: fecha_actualizacion automática
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_actualizar_fecha() RETURNS trigger AS $$
BEGIN
  NEW.fecha_actualizacion := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','propietarios','veterinarios','mascotas','citas',
                           'historias_clinicas','consultas','tratamientos','vacunas',
                           'catalogo_vacunas']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_actualizacion BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha()', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
--  Trigger: al registrar un usuario se crea su perfil según el rol
--  (así /api/auth/register no necesita cambios)
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_crear_perfil() RETURNS trigger AS $$
DECLARE rol TEXT;
BEGIN
  SELECT nombre INTO rol FROM roles WHERE id_rol = NEW.id_rol;
  IF rol = 'propietario' THEN
    INSERT INTO propietarios (id_usuario) VALUES (NEW.id_usuario);
  ELSIF rol = 'veterinario' THEN
    INSERT INTO veterinarios (id_usuario) VALUES (NEW.id_usuario);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuario_perfil AFTER INSERT ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_crear_perfil();

-- ---------------------------------------------------------------------
--  Trigger: historia clínica automática al registrar una mascota
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_crear_historia() RETURNS trigger AS $$
BEGIN
  INSERT INTO historias_clinicas (id_mascota, numero)
  VALUES (NEW.id_mascota, 'HC-' || lpad(NEW.id_mascota::text, 6, '0'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mascota_historia AFTER INSERT ON mascotas
FOR EACH ROW EXECUTE FUNCTION fn_crear_historia();

-- ---------------------------------------------------------------------
--  Trigger: un veterinario no puede tener horarios que se traslapen el mismo día
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_validar_traslape_horario() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM horarios_veterinario h
     WHERE h.id_veterinario = NEW.id_veterinario
       AND h.dia_semana     = NEW.dia_semana
       AND h.id_horario    <> COALESCE(NEW.id_horario, -1)
       AND NEW.hora_inicio  < h.hora_fin
       AND NEW.hora_fin     > h.hora_inicio
  ) THEN
    RAISE EXCEPTION 'El horario % - % se cruza con otro horario del mismo día', NEW.hora_inicio, NEW.hora_fin
      USING ERRCODE = '23P01';   -- exclusion_violation
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_horario_traslape BEFORE INSERT OR UPDATE ON horarios_veterinario
FOR EACH ROW EXECUTE FUNCTION fn_validar_traslape_horario();

-- ---------------------------------------------------------------------
--  Trigger genérico de auditoría
--  TG_ARGV[0] = nombre de la columna llave primaria de la tabla auditada
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_auditar() RETURNS trigger AS $$
DECLARE
  antes   JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  despues JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  usuario INT   := NULLIF(current_setting('app.id_usuario', true), '')::INT;
BEGIN
  -- No registrar UPDATE que no cambian nada (solo fecha_actualizacion)
  IF TG_OP = 'UPDATE' AND (antes - 'fecha_actualizacion') = (despues - 'fecha_actualizacion') THEN
    RETURN NEW;
  END IF;
  INSERT INTO auditoria (id_usuario, accion, tabla_afectada, id_registro, detalle)
  VALUES (usuario, TG_OP, TG_TABLE_NAME,
          COALESCE(despues, antes) ->> TG_ARGV[0],
          jsonb_strip_nulls(jsonb_build_object('antes', antes, 'despues', despues)));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditar_historias    AFTER INSERT OR UPDATE OR DELETE ON historias_clinicas
FOR EACH ROW EXECUTE FUNCTION fn_auditar('id_historia');
CREATE TRIGGER trg_auditar_consultas    AFTER INSERT OR UPDATE OR DELETE ON consultas
FOR EACH ROW EXECUTE FUNCTION fn_auditar('id_consulta');
CREATE TRIGGER trg_auditar_tratamientos AFTER INSERT OR UPDATE OR DELETE ON tratamientos
FOR EACH ROW EXECUTE FUNCTION fn_auditar('id_tratamiento');
CREATE TRIGGER trg_auditar_vacunas      AFTER INSERT OR UPDATE OR DELETE ON vacunas
FOR EACH ROW EXECUTE FUNCTION fn_auditar('id_vacuna');

COMMIT;
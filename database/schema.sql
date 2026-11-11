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

DROP TABLE IF EXISTS auditoria, horarios_veterinario, mensajes, conversaciones, recordatorios,
  evoluciones_tratamiento, tratamientos, vacunas, consultas, historias_clinicas, citas, mascotas,
  veterinarios, propietarios, usuarios, roles CASCADE;
DROP TYPE IF EXISTS sexo_mascota, estado_cita, estado_tratamiento,
  tipo_recordatorio, estado_recordatorio CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_fecha, fn_crear_perfil, fn_crear_historia,
  fn_validar_traslape_horario, fn_auditar CASCADE;

-- ---------------------------------------------------------------------
--  Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE sexo_mascota        AS ENUM ('macho', 'hembra', 'desconocido');
CREATE TYPE estado_cita         AS ENUM ('programada', 'reprogramada', 'cancelada', 'atendida', 'no_asistio');
CREATE TYPE estado_tratamiento  AS ENUM ('activo', 'finalizado', 'suspendido');
CREATE TYPE tipo_recordatorio   AS ENUM ('cita', 'vacuna', 'tratamiento', 'seguimiento');
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

CREATE TABLE vacunas (
  id_vacuna            SERIAL PRIMARY KEY,
  id_historia          INT NOT NULL REFERENCES historias_clinicas(id_historia) ON DELETE CASCADE,
  id_veterinario       INT REFERENCES veterinarios(id_veterinario) ON DELETE SET NULL,
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
  fecha_registro    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recordatorios_pendientes ON recordatorios(fecha_programada) WHERE estado = 'pendiente';

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
                           'historias_clinicas','consultas','tratamientos','vacunas']
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

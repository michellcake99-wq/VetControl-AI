-- =====================================================================
--  VetControl AI - Migración Ep6-Hu1: interacciones con la IA
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae estos cambios.)
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS interacciones_ia (
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
CREATE INDEX IF NOT EXISTS ix_interacciones_ia_usuario_fecha ON interacciones_ia (id_usuario, fecha DESC);

COMMIT;

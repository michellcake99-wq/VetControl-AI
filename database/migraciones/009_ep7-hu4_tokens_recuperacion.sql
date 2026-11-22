-- =====================================================================
--  VetControl AI - Migración Ep7-Hu4: recuperación de contraseña
--
--  Tabla tokens_recuperacion: el enlace que se envía por correo lleva un token aleatorio de un solo uso
--  que vale 1 hora. En la base solo se guarda su HASH (SHA-256), nunca el token, así que quien lea la
--  base de datos no puede usarlo.
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada y se puede
--  ejecutar varias veces. Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS tokens_recuperacion (
  id_token          SERIAL PRIMARY KEY,
  id_usuario        INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  token_hash        CHAR(64) NOT NULL UNIQUE,          -- SHA-256 del token, en hexadecimal
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_expiracion  TIMESTAMPTZ NOT NULL,
  usado             BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_usuario ON tokens_recuperacion (id_usuario, fecha_creacion DESC);

-- =====================================================================
--  VetControl AI - Migración Ep7-Hu3: bloqueo por intentos fallidos de inicio de sesión
--
--  Cada intento fallido (contraseña incorrecta o correo inexistente) se guarda aquí.
--  Con 5 intentos fallidos en 15 minutos el inicio de sesión de ese correo se bloquea
--  hasta que pasen 15 minutos desde el quinto intento. Un inicio de sesión correcto
--  borra los intentos de ese correo.
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada y se puede
--  ejecutar varias veces. Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS intentos_login (
  id_intento  BIGSERIAL PRIMARY KEY,
  correo      VARCHAR(120) NOT NULL,   -- en minúsculas
  fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intentos_login_correo ON intentos_login (correo, fecha DESC);

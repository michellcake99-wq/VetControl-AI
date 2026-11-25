-- =====================================================================
--  VetControl AI - Migración Ep4-Hu3: seguimiento de la evolución de la mascota
--
--  Tabla seguimiento_peso: peso (kg), fecha y observaciones de una mascota a lo largo del tiempo.
--  Lo pueden registrar el veterinario y el propietario; queda guardado quién lo registró.
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada y se puede
--  ejecutar varias veces. Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS seguimiento_peso (
  id_seguimiento  SERIAL PRIMARY KEY,
  id_mascota      INT NOT NULL REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
  id_usuario      INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,  -- quién lo registró
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE CHECK (fecha <= CURRENT_DATE),
  peso_kg         NUMERIC(6,2) NOT NULL CHECK (peso_kg > 0),
  observaciones   TEXT,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seguimiento_peso_mascota ON seguimiento_peso (id_mascota, fecha DESC);

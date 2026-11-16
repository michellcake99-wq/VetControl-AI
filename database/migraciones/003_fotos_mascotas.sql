-- =====================================================================
--  VetControl AI - Migración: foto de cada mascota
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
BEGIN;

-- Foto como "data URL" (la imagen se reduce en el navegador antes de enviarla)
ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS foto TEXT;

ALTER TABLE mascotas DROP CONSTRAINT IF EXISTS mascotas_foto_check;
ALTER TABLE mascotas ADD CONSTRAINT mascotas_foto_check
  CHECK (foto IS NULL OR length(foto) <= 500000);

COMMIT;

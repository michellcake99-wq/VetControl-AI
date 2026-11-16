-- =====================================================================
--  VetControl AI - Migración: tipo de consulta en las citas
--
--  Agrega el campo «tipo_consulta» a las citas (consulta general, vacunación,
--  control, desparasitación, cirugía, urgencia u otro). Las citas que ya
--  existen quedan como «consulta_general».
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS tipo_consulta VARCHAR(30) NOT NULL DEFAULT 'consulta_general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'citas_tipo_consulta_check'
  ) THEN
    ALTER TABLE citas ADD CONSTRAINT citas_tipo_consulta_check CHECK (tipo_consulta IN
      ('consulta_general', 'vacunacion', 'control', 'desparasitacion', 'cirugia', 'urgencia', 'otro'));
  END IF;
END $$;

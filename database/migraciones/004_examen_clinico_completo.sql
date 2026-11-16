-- =====================================================================
--  VetControl AI - Migración Ep3-Hu13: examen clínico completo
--  (pulso, tiempo de llenado capilar, ganglios, mucosas, actitud y
--   órganos y sistemas, como en el formato de historia clínica)
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae estos cambios.)
-- =====================================================================
BEGIN;

ALTER TABLE consultas
  ADD COLUMN IF NOT EXISTS pulso                  SMALLINT CHECK (pulso > 0),
  ADD COLUMN IF NOT EXISTS tiempo_llenado_capilar NUMERIC(3,1) CHECK (tiempo_llenado_capilar > 0),
  ADD COLUMN IF NOT EXISTS ganglios_linfaticos    VARCHAR(300),
  ADD COLUMN IF NOT EXISTS mucosas                VARCHAR(200),
  ADD COLUMN IF NOT EXISTS actitud                VARCHAR(20)
      CHECK (actitud IN ('alerta','letargico','estuporoso','comatoso','otro')),
  ADD COLUMN IF NOT EXISTS actitud_otro           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS organos_sistemas       JSONB;

COMMIT;

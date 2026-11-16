-- =====================================================================
--  VetControl AI - Migración Ep3-Hu14: estado «confirmada» para las citas
--
--  El veterinario confirma la cita que solicitó el propietario.
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
ALTER TYPE estado_cita ADD VALUE IF NOT EXISTS 'confirmada' AFTER 'programada';

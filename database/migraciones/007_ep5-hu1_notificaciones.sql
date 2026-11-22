-- =====================================================================
--  VetControl AI - Migración Ep5-Hu1: notificaciones y recordatorios
--
--  Usa la tabla «recordatorios» como bandeja de notificaciones de cada usuario
--  (icono de la campana) y cola de correos:
--    - tipo «aviso»: notificaciones inmediatas (por ejemplo, «nueva cita solicitada»).
--    - titulo / enlace: lo que se muestra en la campana y a dónde lleva al tocarla.
--    - fecha_evento: fecha del evento recordado (la cita, la dosis...). Junto con el
--      usuario, el tipo y la referencia evita que llegue el mismo recordatorio dos veces.
--    - leido / fecha_lectura: notificación marcada como leída.
--    - fecha_envio: cuándo se envió el correo.
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
ALTER TYPE tipo_recordatorio ADD VALUE IF NOT EXISTS 'aviso';

ALTER TABLE recordatorios
  ADD COLUMN IF NOT EXISTS titulo        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS enlace        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS fecha_evento  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leido         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_lectura TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_envio   TIMESTAMPTZ;

-- Un mismo recordatorio (usuario + tipo + referencia + fecha del evento) no se repite
CREATE UNIQUE INDEX IF NOT EXISTS uq_recordatorios_evento
  ON recordatorios (id_usuario, tipo, id_referencia, fecha_evento)
  WHERE fecha_evento IS NOT NULL AND estado <> 'cancelado';

-- Bandeja de notificaciones de cada usuario (las más recientes primero)
CREATE INDEX IF NOT EXISTS idx_recordatorios_usuario
  ON recordatorios (id_usuario, fecha_programada DESC);

-- =====================================================================
--  VetControl AI - Migración Ep4-Hu1: catálogo de vacunas
--
--  Para bases que YA tienen datos (por ejemplo, Supabase). No borra nada
--  y se puede ejecutar varias veces sin problema.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae estos cambios.)
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS catalogo_vacunas (
  id_catalogo          SERIAL PRIMARY KEY,
  nombre               VARCHAR(100) NOT NULL UNIQUE,
  especie              VARCHAR(40),
  descripcion          VARCHAR(300),
  dias_refuerzo        SMALLINT CHECK (dias_refuerzo > 0),
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalogo_vacunas (nombre, especie, descripcion, dias_refuerzo) VALUES
  ('Rabia',                  NULL,     'Obligatoria en perros y gatos',                                365),
  ('Pentavalente canina',    'canino', 'Moquillo, hepatitis, parvovirus, parainfluenza y leptospirosis', 365),
  ('Parvovirus canino',      'canino', 'Refuerzo específico contra parvovirus',                      365),
  ('Moquillo canino',        'canino', 'Refuerzo específico contra moquillo',                        365),
  ('Leptospirosis',          'canino', 'Protección contra leptospira',                               365),
  ('Tos de las perreras',    'canino', 'Bordetella bronchiseptica',                                  365),
  ('Triple felina',          'felino', 'Rinotraqueítis, calicivirus y panleucopenia',                 365),
  ('Leucemia felina',        'felino', 'Virus de la leucemia felina (FeLV)',                          365)
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE vacunas
  ADD COLUMN IF NOT EXISTS id_catalogo INT REFERENCES catalogo_vacunas(id_catalogo) ON DELETE SET NULL;

-- Enlaza las vacunas ya registradas cuyo nombre coincide con el catálogo
UPDATE vacunas v SET id_catalogo = c.id_catalogo
  FROM catalogo_vacunas c
 WHERE v.id_catalogo IS NULL AND lower(v.nombre) = lower(c.nombre);
UPDATE vacunas v SET id_catalogo = c.id_catalogo, nombre = c.nombre
  FROM catalogo_vacunas c
 WHERE v.id_catalogo IS NULL AND v.nombre = 'Pentavalente' AND c.nombre = 'Pentavalente canina';

DROP TRIGGER IF EXISTS trg_catalogo_vacunas_actualizacion ON catalogo_vacunas;
CREATE TRIGGER trg_catalogo_vacunas_actualizacion BEFORE UPDATE ON catalogo_vacunas
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

COMMIT;

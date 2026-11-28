-- =====================================================================
--  VetControl AI - Migración Ep5-Hu5: notas de seguimiento inmutables
--
--  Las notas de seguimiento de un tratamiento (tabla evoluciones_tratamiento)
--  guardan quién las escribió y cuándo, y NO se pueden eliminar. La API ya no
--  ofrece rutas para editarlas o borrarlas; este trigger además lo impide a
--  nivel de base de datos (por ejemplo, desde el editor SQL).
--
--  Requiere haber ejecutado antes la migración 011.
--  No borra datos y se puede ejecutar varias veces.
--  Supabase: SQL Editor > New query > pegar este archivo > Run.
--  (Una base nueva no lo necesita: schema.sql ya trae este cambio.)
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION fn_proteger_evoluciones() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las notas de seguimiento no se pueden modificar ni eliminar'
    USING ERRCODE = '23001';   -- restrict_violation
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evoluciones_inmutables ON evoluciones_tratamiento;
CREATE TRIGGER trg_evoluciones_inmutables BEFORE UPDATE OR DELETE ON evoluciones_tratamiento
FOR EACH ROW EXECUTE FUNCTION fn_proteger_evoluciones();

COMMIT;

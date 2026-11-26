
-- =====================================================================
-- VetControl AI - Migración Ep5-Hu5
-- Registro del seguimiento de tratamientos
-- =====================================================================

BEGIN;

-- La descripción será el único dato obligatorio.
-- Se conserva el campo para mantener compatibilidad con registros anteriores.
ALTER TABLE evoluciones_tratamiento
    ALTER COLUMN estado_general DROP NOT NULL;

-- Evitar que la eliminación de un tratamiento borre sus seguimientos.
ALTER TABLE evoluciones_tratamiento
    DROP CONSTRAINT IF EXISTS evoluciones_tratamiento_id_tratamiento_fkey;

ALTER TABLE evoluciones_tratamiento
    ADD CONSTRAINT evoluciones_tratamiento_id_tratamiento_fkey
    FOREIGN KEY (id_tratamiento)
    REFERENCES tratamientos(id_tratamiento)
    ON DELETE RESTRICT;

COMMIT;

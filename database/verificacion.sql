-- =====================================================================
--  VetControl AI - Verificación del modelo (Ep3-Hu5)
--  Ejecutar en pgAdmin (Query Tool sobre vetcontrol_ai) DESPUÉS de schema.sql.
--  Cada consulta muestra una evidencia para el criterio de aceptación.
-- =====================================================================

-- 1. Tablas creadas (deben ser 16)
SELECT count(*) AS total_tablas
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Atributos y tipos de cada tabla
SELECT table_name AS tabla, column_name AS columna,
       CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE data_type END AS tipo,
       character_maximum_length AS longitud,
       is_nullable AS permite_nulo,
       column_default AS valor_por_defecto
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Llaves primarias, foráneas, únicas y CHECK
SELECT tc.table_name AS tabla, tc.constraint_type AS tipo,
       string_agg(DISTINCT kcu.column_name, ', ') AS columnas,
       tc.constraint_name AS restriccion
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
  AND tc.constraint_name NOT LIKE '%_not_null'
GROUP BY tc.table_name, tc.constraint_type, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_type;

-- 4. Relaciones (tabla hija -> tabla padre)
SELECT cl.relname AS tabla_hija, a.attname AS columna_fk,
       fcl.relname AS tabla_padre,
       CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT'
                          WHEN 'n' THEN 'SET NULL' ELSE 'NO ACTION' END AS al_eliminar
FROM pg_constraint c
JOIN pg_class cl  ON cl.oid  = c.conrelid
JOIN pg_class fcl ON fcl.oid = c.confrelid
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE c.contype = 'f' AND n.nspname = 'public'
ORDER BY tabla_padre, tabla_hija;

-- 5. Roles precargados (deben ser administrador, veterinario, propietario)
SELECT * FROM roles ORDER BY id_rol;

-- 6. Prueba de los triggers dentro de una transacción que se deshace (no deja datos)
BEGIN;
  INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
  VALUES ((SELECT id_rol FROM roles WHERE nombre = 'propietario'), 'Prueba', 'Modelo', 'prueba@modelo.com', 'x');
  -- El perfil de propietario se crea solo:
  INSERT INTO mascotas (id_propietario, nombre, especie)
  SELECT p.id_propietario, 'Firulais', 'canino'
  FROM propietarios p JOIN usuarios u ON u.id_usuario = p.id_usuario
  WHERE u.correo = 'prueba@modelo.com';
  -- La historia clínica se crea sola:
  SELECT u.correo, p.id_propietario AS perfil_creado, m.nombre AS mascota,
         h.numero AS historia_creada_automaticamente
  FROM usuarios u
  JOIN propietarios p ON p.id_usuario = u.id_usuario
  JOIN mascotas m ON m.id_propietario = p.id_propietario
  JOIN historias_clinicas h ON h.id_mascota = m.id_mascota
  WHERE u.correo = 'prueba@modelo.com';
ROLLBACK;

-- 7. Horarios de atención cargados (1 = lunes ... 7 = domingo)
SELECT u.nombre || ' ' || u.apellido AS veterinario, h.dia_semana, h.hora_inicio, h.hora_fin
FROM horarios_veterinario h
JOIN veterinarios v ON v.id_veterinario = h.id_veterinario
JOIN usuarios u ON u.id_usuario = v.id_usuario
ORDER BY veterinario, h.dia_semana, h.hora_inicio;

-- 8. Auditoría: un cambio clínico queda registrado (se deshace al final)
BEGIN;
  UPDATE historias_clinicas SET alergias = 'Prueba de auditoría' WHERE id_historia = 1;
  SELECT accion, tabla_afectada, id_registro, detalle, fecha
  FROM auditoria ORDER BY id_auditoria DESC LIMIT 1;
ROLLBACK;

-- 9. (Opcional) Comprobar que las restricciones rechazan datos inválidos.
--    Ejecute UNA línea a la vez (selecciónela y F5); cada una debe mostrar un ERROR:
-- INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash) VALUES (99, 'a', 'b', 'a@a.com', 'x'); -- FK rol inexistente
-- INSERT INTO mascotas (id_propietario, nombre, especie) VALUES (999999, 'X', 'canino');                          -- FK propietario inexistente
-- UPDATE mascotas SET peso_kg = -5 WHERE id_mascota = 1;                                                         -- CHECK peso > 0
-- INSERT INTO horarios_veterinario (id_veterinario, dia_semana, hora_inicio, hora_fin) VALUES (1, 1, '11:00', '15:00'); -- se cruza con otro horario

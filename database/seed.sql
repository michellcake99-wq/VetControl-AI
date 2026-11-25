-- =====================================================================
--  VetControl AI - Datos de prueba
--  Ejecutar DESPUÉS de schema.sql (pgAdmin > Query Tool > F5).
--  Contraseña de todos los usuarios: Vet12345
-- =====================================================================
BEGIN;

TRUNCATE usuarios, propietarios, veterinarios, mascotas, citas, historias_clinicas,
         consultas, tratamientos, evoluciones_tratamiento, vacunas, seguimiento_peso, recordatorios,
         conversaciones, mensajes, horarios_veterinario, interacciones_ia, auditoria RESTART IDENTITY CASCADE;

-- Hash bcrypt de "Vet12345" (compatible con bcrypt.compare de routes/auth.js)
INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
SELECT r.id_rol, u.nombre, u.apellido, u.correo,
       '$2b$10$OSrMcMcgkP6CjMjp9nA.w.QiofOt6UHAxt53pfGJjLTIEbCg6zd/e'
FROM (VALUES
  (1, 'administrador', 'Admin',  'VetControl', 'admin@vetcontrol.com'),
  (2, 'veterinario',   'Laura',  'Quintero',   'vet@vetcontrol.com'),
  (3, 'veterinario',   'Andrés', 'Pérez',      'vet2@vetcontrol.com'),
  (4, 'propietario',   'Ana',    'Torres',     'ana@correo.com'),
  (5, 'propietario',   'Carlos', 'Rincón',     'carlos@correo.com'),
  (6, 'propietario',   'Marta',  'Gómez',      'marta@correo.com')
) AS u(orden, rol, nombre, apellido, correo)
JOIN roles r ON r.nombre = u.rol
ORDER BY u.orden;
-- (El trigger trg_usuario_perfil ya creó las filas en propietarios y veterinarios)

UPDATE veterinarios v SET tarjeta_profesional = x.tp, especialidad = x.esp
FROM (VALUES ('vet@vetcontrol.com', 'MV-10234', 'Medicina interna'),
             ('vet2@vetcontrol.com', 'MV-20456', 'Cirugía')) AS x(correo, tp, esp)
JOIN usuarios u ON u.correo = x.correo
WHERE v.id_usuario = u.id_usuario;

UPDATE propietarios p SET numero_documento = x.doc, telefono = x.tel, direccion = x.dir
FROM (VALUES ('ana@correo.com',    '1091000001', '3001234567', 'Calle 10 # 5-20, Ocaña'),
             ('carlos@correo.com', '1091000002', '3109876543', 'Barrio La Primavera, Ocaña'),
             ('marta@correo.com',  '1091000003', '3155550000', NULL)) AS x(correo, doc, tel, dir)
JOIN usuarios u ON u.correo = x.correo
WHERE p.id_usuario = u.id_usuario;

-- Horarios de atención (1 = lunes ... 7 = domingo)
INSERT INTO horarios_veterinario (id_veterinario, dia_semana, hora_inicio, hora_fin)
SELECT 1, d, '07:00'::time, '12:00'::time FROM generate_series(1, 5) d       -- Laura: lunes a viernes mañana
UNION ALL
SELECT 1, d, '14:00'::time, '18:00'::time FROM generate_series(1, 5) d       -- Laura: lunes a viernes tarde
UNION ALL
SELECT 2, d, '08:00'::time, '16:00'::time FROM generate_series(2, 6) d;      -- Andrés: martes a sábado

-- id_propietario: 1 = Ana, 2 = Carlos, 3 = Marta  ·  id_veterinario: 1 = Laura, 2 = Andrés
INSERT INTO mascotas (id_propietario, nombre, especie, raza, sexo, fecha_nacimiento, color, peso_kg, esterilizado) VALUES
  (1, 'Max',   'canino', 'Labrador',  'macho',  '2021-03-15', 'Dorado', 28.5, TRUE),
  (1, 'Luna',  'felino', 'Criollo',   'hembra', '2023-07-01', 'Gris',   4.2,  TRUE),
  (2, 'Rocky', 'canino', 'Bulldog',   'macho',  '2020-11-20', 'Blanco', 22.0, FALSE),
  (3, 'Kiwi',  'ave',    'Periquito', 'desconocido', NULL,  'Verde',  0.05, FALSE);
-- (El trigger trg_mascota_historia ya creó HC-000001 ... HC-000004)

UPDATE historias_clinicas SET alergias = 'Penicilina', antecedentes = 'Displasia leve de cadera'
WHERE id_mascota = 1;

INSERT INTO citas (id_mascota, id_veterinario, fecha_hora, motivo, tipo_consulta, estado) VALUES
  (1, 1, now() - interval '10 days', 'Control anual', 'control', 'atendida'),
  (3, 1, now() + interval '3 days',  'Revisión de piel', 'consulta_general', 'programada');

INSERT INTO consultas (id_historia, id_veterinario, id_cita, fecha, motivo, anamnesis, peso_kg,
                       temperatura_c, frecuencia_cardiaca, diagnostico, proximo_control) VALUES
  (1, 1, 1, now() - interval '10 days', 'Control anual', 'Cojea de la pata trasera derecha tras ejercicio',
   28.5, 38.6, 90, 'Inflamación articular leve asociada a displasia', CURRENT_DATE + 20);

INSERT INTO tratamientos (id_consulta, medicamento, dosis, frecuencia, via, fecha_inicio, fecha_fin, indicaciones) VALUES
  (1, 'Meloxicam', '0.1 mg/kg', 'cada 24 horas', 'oral', CURRENT_DATE - 10, CURRENT_DATE + 4, 'Administrar con comida');

INSERT INTO evoluciones_tratamiento (id_tratamiento, id_usuario, fecha, estado_general, descripcion)
SELECT 1, id_usuario, now() - interval '5 days', 4, 'Camina mejor, ya no cojea al levantarse'
FROM usuarios WHERE correo = 'ana@correo.com';

-- Ep4-Hu1: cada vacuna queda enlazada a su vacuna del catálogo
INSERT INTO vacunas (id_historia, id_veterinario, id_catalogo, nombre, laboratorio, lote, fecha_aplicacion, proxima_dosis)
SELECT v.id_historia, 1, c.id_catalogo, c.nombre, v.laboratorio, v.lote, v.aplicacion, v.proxima
FROM (VALUES
  (1, 1, 'Rabia',               'Zoetis', 'RB-2291', CURRENT_DATE - 300, CURRENT_DATE + 65),
  (2, 1, 'Pentavalente canina', 'MSD',    'PV-1180', CURRENT_DATE - 300, CURRENT_DATE + 65),
  (3, 2, 'Triple felina',       'Zoetis', 'TF-0042', CURRENT_DATE - 30,  CURRENT_DATE + 335)
) AS v(orden, id_historia, nombre, laboratorio, lote, aplicacion, proxima)
JOIN catalogo_vacunas c ON c.nombre = v.nombre
ORDER BY v.orden;

-- Ep4-Hu3: seguimiento de peso de Max (id_mascota 1). El último registro coincide con su peso actual
-- (28,5 kg). Uno lo registró la dueña (Ana) y los otros la veterinaria Laura. Luna, Rocky y Kiwi
-- quedan sin registros.
INSERT INTO seguimiento_peso (id_mascota, id_usuario, fecha, peso_kg, observaciones)
SELECT 1, u.id_usuario, s.fecha, s.peso_kg, s.observaciones
FROM (VALUES
  (CURRENT_DATE - 90, 'ana@correo.com',      27.00, 'Pesado en casa. Come con buen apetito'),
  (CURRENT_DATE - 45, 'vet@vetcontrol.com',  27.80, 'Control de rutina: buena condición corporal'),
  (CURRENT_DATE - 7,  'vet@vetcontrol.com',  28.50, 'Peso estable; se recomienda mantener la dieta')
) AS s(fecha, correo, peso_kg, observaciones)
JOIN usuarios u ON u.correo = s.correo
ORDER BY s.fecha;

-- Los datos de prueba no cuentan como cambios de usuarios: se limpia la auditoría
TRUNCATE auditoria RESTART IDENTITY;

COMMIT;
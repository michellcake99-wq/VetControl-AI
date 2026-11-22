// Ep3-Hu5: el modelo de datos garantiza la integridad
const { pool, reiniciarBase } = require('./helpers');

beforeAll(reiniciarBase);
afterAll(() => pool.end());

const q = (sql, p) => pool.query(sql, p);

test('existen las 19 tablas del modelo', async () => {
    const { rows } = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
    expect(rows.map((r) => r.table_name)).toEqual([
        'auditoria', 'catalogo_vacunas', 'citas', 'consultas', 'conversaciones', 'evoluciones_tratamiento', 'historias_clinicas',
        'horarios_veterinario', 'intentos_login', 'interacciones_ia', 'mascotas', 'mensajes', 'propietarios', 'recordatorios', 'roles', 'tratamientos',
        'usuarios', 'vacunas', 'veterinarios',
    ]);
});

test('los tres roles se cargan con el script', async () => {
    const { rows } = await q('SELECT nombre FROM roles ORDER BY id_rol');
    expect(rows.map((r) => r.nombre)).toEqual(['administrador', 'veterinario', 'propietario']);
});

test('usuarios exige un rol existente (FK)', async () => {
    await expect(q(`INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash) VALUES (99, 'a', 'b', 'x@x.com', 'h')`))
        .rejects.toMatchObject({ code: '23503' });
});

test('el correo es único y obligatorio', async () => {
    await expect(q(`INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash) VALUES (2, 'a', 'b', 'vet@vetcontrol.com', 'h')`))
        .rejects.toMatchObject({ code: '23505' });
    await expect(q(`INSERT INTO usuarios (id_rol, nombre, apellido, contrasena_hash) VALUES (2, 'a', 'b', 'h')`))
        .rejects.toMatchObject({ code: '23502' });
});

test('al crear un usuario se crea su perfil según el rol (trigger)', async () => {
    const p = await q(`INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
                       VALUES ((SELECT id_rol FROM roles WHERE nombre='propietario'), 'P', 'Q', 'p@q.com', 'h') RETURNING id_usuario`);
    expect((await q('SELECT 1 FROM propietarios WHERE id_usuario = $1', [p.rows[0].id_usuario])).rowCount).toBe(1);
    const v = await q(`INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash)
                       VALUES ((SELECT id_rol FROM roles WHERE nombre='veterinario'), 'V', 'W', 'v@w.com', 'h') RETURNING id_usuario`);
    expect((await q('SELECT 1 FROM veterinarios WHERE id_usuario = $1', [v.rows[0].id_usuario])).rowCount).toBe(1);
});

test('al registrar una mascota se crea su historia clínica (trigger)', async () => {
    const m = await q(`INSERT INTO mascotas (id_propietario, nombre, especie) VALUES (2, 'Toby', 'canino') RETURNING id_mascota`);
    const h = await q('SELECT numero FROM historias_clinicas WHERE id_mascota = $1', [m.rows[0].id_mascota]);
    expect(h.rows[0].numero).toBe(`HC-${String(m.rows[0].id_mascota).padStart(6, '0')}`);
});

test('los valores por defecto se aplican', async () => {
    const { rows } = await q(`INSERT INTO mascotas (id_propietario, nombre, especie) VALUES (1, 'Def', 'canino')
                              RETURNING sexo, esterilizado, activo, fecha_registro`);
    expect(rows[0]).toMatchObject({ sexo: 'desconocido', esterilizado: false, activo: true });
    expect(rows[0].fecha_registro).toBeInstanceOf(Date);
});

test('no permite mascota con propietario inexistente (FK)', async () => {
    await expect(q(`INSERT INTO mascotas (id_propietario, nombre, especie) VALUES (999, 'X', 'canino')`))
        .rejects.toMatchObject({ code: '23503' });
});

test('no permite documento de propietario repetido (UNIQUE)', async () => {
    await expect(q(`UPDATE propietarios SET numero_documento = '1091000001' WHERE id_propietario = 2`))
        .rejects.toMatchObject({ code: '23505' });
});

test('valida rangos con CHECK (peso, temperatura, fechas)', async () => {
    await expect(q('UPDATE mascotas SET peso_kg = -1 WHERE id_mascota = 1')).rejects.toMatchObject({ code: '23514' });
    await expect(q('UPDATE consultas SET temperatura_c = 60 WHERE id_consulta = 1')).rejects.toMatchObject({ code: '23514' });
    await expect(q('UPDATE tratamientos SET fecha_fin = fecha_inicio - 1 WHERE id_tratamiento = 1')).rejects.toMatchObject({ code: '23514' });
    await expect(q('UPDATE vacunas SET proxima_dosis = fecha_aplicacion WHERE id_vacuna = 1')).rejects.toMatchObject({ code: '23514' });
});

test('no permite borrar un propietario con mascotas (RESTRICT)', async () => {
    await expect(q('DELETE FROM propietarios WHERE id_propietario = 1')).rejects.toMatchObject({ code: '23503' });
});

test('fecha_actualizacion cambia con el trigger', async () => {
    const antes = (await q('SELECT fecha_actualizacion FROM mascotas WHERE id_mascota = 1')).rows[0].fecha_actualizacion;
    await new Promise((r) => setTimeout(r, 20));
    const despues = (await q(`UPDATE mascotas SET color = 'Café' WHERE id_mascota = 1 RETURNING fecha_actualizacion`)).rows[0].fecha_actualizacion;
    expect(despues.getTime()).toBeGreaterThan(antes.getTime());
});

describe('horarios_veterinario', () => {
    const insertar = (vet, dia, ini, fin) => q(
        'INSERT INTO horarios_veterinario (id_veterinario, dia_semana, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)',
        [vet, dia, ini, fin]
    );

    test('exige un veterinario existente (FK)', async () => {
        await expect(insertar(999, 1, '07:00', '08:00')).rejects.toMatchObject({ code: '23503' });
    });

    test('valida día de la semana 1-7 y que la hora final sea mayor', async () => {
        await expect(insertar(1, 8, '07:00', '08:00')).rejects.toMatchObject({ code: '23514' });
        await expect(insertar(1, 6, '10:00', '09:00')).rejects.toMatchObject({ code: '23514' });
    });

    test('no permite horarios que se crucen el mismo día', async () => {
        // Laura (1) trabaja lunes 07:00-12:00 y 14:00-18:00
        await expect(insertar(1, 1, '11:00', '15:00')).rejects.toMatchObject({ code: '23P01' });
        await expect(insertar(1, 1, '12:00', '14:00')).resolves.toBeDefined();   // hueco del almuerzo: válido
        await expect(insertar(1, 6, '11:00', '15:00')).resolves.toBeDefined();   // sábado: válido
    });
});

describe('auditoria', () => {
    test('registra los cambios clínicos con el antes y el después', async () => {
        await q(`UPDATE historias_clinicas SET alergias = 'Polen' WHERE id_historia = 2`);
        const { rows } = await q(`SELECT * FROM auditoria WHERE tabla_afectada = 'historias_clinicas' AND id_registro = '2'`);
        expect(rows[0]).toMatchObject({ accion: 'UPDATE', id_usuario: null });  // hecho fuera de la app
        expect(rows[0].detalle.despues.alergias).toBe('Polen');
        expect(rows[0].detalle.antes.alergias).toBeUndefined();                 // antes era NULL
    });

    test('no registra un UPDATE que no cambia nada', async () => {
        const antes = (await q('SELECT count(*)::int AS n FROM auditoria')).rows[0].n;
        await q('UPDATE vacunas SET nombre = nombre WHERE id_vacuna = 1');
        expect((await q('SELECT count(*)::int AS n FROM auditoria')).rows[0].n).toBe(antes);
    });
});
const { query, enTransaccion, construirInsert, construirUpdate } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado, sinPermiso } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');
const { sinRomper, sincronizarVacunasRelacionadas, cancelarRecordatoriosTratamiento } = require('../utils/notificaciones');
const { esPersonal, obtenerMascotaAutorizada, obtenerHistoriaAutorizada } = require('../utils/acceso');

const NOMBRE_VETERINARIO = `(SELECT u.nombre || ' ' || u.apellido FROM veterinarios v
                              JOIN usuarios u ON u.id_usuario = v.id_usuario
                             WHERE v.id_veterinario = c.id_veterinario) AS nombre_veterinario`;

// Ep4-Hu1: datos de una vacuna aplicada + quién la aplicó + datos del catálogo
const SELECT_VACUNA = `SELECT va.*,
        (SELECT u.nombre || ' ' || u.apellido FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
          WHERE v.id_veterinario = va.id_veterinario) AS nombre_veterinario,
        cv.especie AS especie_catalogo, cv.dias_refuerzo
   FROM vacunas va LEFT JOIN catalogo_vacunas cv ON cv.id_catalogo = va.id_catalogo`;
// Carné en orden cronológico (de la primera aplicación a la más reciente)
const ORDEN_CARNE = 'ORDER BY va.fecha_aplicacion, va.id_vacuna';

function exigirPerfilVeterinario(usuario) {
    if (!usuario.id_veterinario) throw sinPermiso('Solo un veterinario puede realizar esta acción');
}

// ------------------------------------------------------------------
//  Historia clínica completa
// ------------------------------------------------------------------
async function historiaCompleta(idHistoria) {
    const [h, consultas, tratamientos, vacunas] = await Promise.all([
        query(
            `SELECT h.*, json_build_object(
                    'id_mascota', m.id_mascota, 'nombre', m.nombre, 'especie', m.especie, 'raza', m.raza,
                    'sexo', m.sexo, 'fecha_nacimiento', m.fecha_nacimiento, 'peso_kg', m.peso_kg,
                    'color', m.color, 'esterilizado', m.esterilizado, 'microchip', m.microchip,
                    'foto', m.foto, 'id_propietario', m.id_propietario) AS mascota,
                    json_build_object(
                    'nombre', u.nombre, 'apellido', u.apellido, 'correo', u.correo,
                    'tipo_documento', p.tipo_documento, 'numero_documento', p.numero_documento,
                    'telefono', p.telefono, 'direccion', p.direccion) AS propietario
               FROM historias_clinicas h JOIN mascotas m ON m.id_mascota = h.id_mascota
               JOIN propietarios p ON p.id_propietario = m.id_propietario
               JOIN usuarios u ON u.id_usuario = p.id_usuario
              WHERE h.id_historia = $1`,
            [idHistoria]
        ),
        query(`SELECT c.*, ${NOMBRE_VETERINARIO} FROM consultas c WHERE c.id_historia = $1 ORDER BY c.fecha DESC`, [idHistoria]),
        query(
            `SELECT t.* FROM tratamientos t JOIN consultas c ON c.id_consulta = t.id_consulta
              WHERE c.id_historia = $1 ORDER BY t.fecha_inicio DESC`,
            [idHistoria]
        ),
        query(`${SELECT_VACUNA} WHERE va.id_historia = $1 ${ORDEN_CARNE}`, [idHistoria]),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    return {
        ...h.rows[0],
        consultas: consultas.rows.map((c) => ({
            ...c,
            tratamientos: tratamientos.rows.filter((t) => t.id_consulta === c.id_consulta),
        })),
        vacunas: vacunas.rows,
        resumen: {
            total_consultas: consultas.rowCount,
            ultima_consulta: consultas.rows[0]?.fecha ?? null,
            tratamientos_activos: tratamientos.rows.filter((t) => t.estado === 'activo').length,
            vacunas_pendientes: vacunas.rows.filter((v) => v.proxima_dosis && v.proxima_dosis >= hoy).length,
        },
    };
}

// GET /api/mascotas/:id/historia
async function obtenerPorMascota(req, res) {
    const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
    const { rows } = await query('SELECT id_historia FROM historias_clinicas WHERE id_mascota = $1', [mascota.id_mascota]);
    if (!rows[0]) throw noEncontrado('Historia clínica');
    res.json(await historiaCompleta(rows[0].id_historia));
}

// GET /api/historias/:id
async function obtener(req, res) {
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);
    res.json(await historiaCompleta(historia.id_historia));
}

// PUT /api/historias/:id   (veterinario) antecedentes, alergias, enfermedades crónicas
async function actualizar(req, res) {
    const { text, values } = construirUpdate('historias_clinicas', 'id_historia', Number(req.params.id), req.body);
    const { rows } = await query(text, values);
    if (!rows[0]) throw noEncontrado('Historia clínica');
    res.json(rows[0]);
}

// ------------------------------------------------------------------
//  Consultas
// ------------------------------------------------------------------

// GET /api/historias/:id/consultas?desde=&hasta=&pagina=&limite=
async function listarConsultas(req, res) {
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);
    const pag = paginar(req);
    const parametros = [historia.id_historia];
    let filtro = '';
    if (req.query.desde) { parametros.push(req.query.desde); filtro += ` AND c.fecha >= $${parametros.length}::date`; }
    if (req.query.hasta) { parametros.push(req.query.hasta); filtro += ` AND c.fecha < ($${parametros.length}::date + 1)`; }

    const total = (await query(`SELECT count(*)::int AS n FROM consultas c WHERE c.id_historia = $1 ${filtro}`, parametros)).rows[0].n;
    const { rows } = await query(
        `SELECT c.*, ${NOMBRE_VETERINARIO},
                (SELECT count(*)::int FROM tratamientos t WHERE t.id_consulta = c.id_consulta) AS total_tratamientos
           FROM consultas c
          WHERE c.id_historia = $1 ${filtro}
          ORDER BY c.fecha DESC
          LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// POST /api/historias/:id/consultas   (veterinario)
async function crearConsulta(req, res) {
    exigirPerfilVeterinario(req.usuario);
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);

    const consulta = await enTransaccion(async (cliente) => {
        const datos = { ...req.body, id_historia: historia.id_historia, id_veterinario: req.usuario.id_veterinario };

        if (datos.id_cita) {
            const cita = await cliente.query('SELECT id_mascota, estado FROM citas WHERE id_cita = $1 FOR UPDATE', [datos.id_cita]);
            if (!cita.rows[0]) throw new ErrorHttp(400, 'La cita indicada no existe');
            if (cita.rows[0].id_mascota !== historia.id_mascota) throw new ErrorHttp(400, 'La cita no corresponde a esta mascota');
            if (cita.rows[0].estado === 'cancelada') throw new ErrorHttp(400, 'No se puede registrar una consulta sobre una cita cancelada');
            await cliente.query(`UPDATE citas SET estado = 'atendida' WHERE id_cita = $1`, [datos.id_cita]);
        }

        const { text, values } = construirInsert('consultas', datos);
        const { rows } = await cliente.query(text, values);
        // Mantener actualizado el peso actual de la mascota
        if (datos.peso_kg) {
            await cliente.query('UPDATE mascotas SET peso_kg = $1 WHERE id_mascota = $2', [datos.peso_kg, historia.id_mascota]);
        }
        return rows[0];
    });
    res.status(201).json(consulta);
}

async function obtenerConsultaAutorizada(idConsulta, usuario) {
    const { rows } = await query('SELECT * FROM consultas WHERE id_consulta = $1', [idConsulta]);
    if (!rows[0]) throw noEncontrado('Consulta');
    await obtenerHistoriaAutorizada(rows[0].id_historia, usuario);
    return rows[0];
}

// GET /api/consultas/:id   detalle + datos del paciente y del propietario (hoja de la consulta)
async function obtenerConsulta(req, res) {
    const consulta = await obtenerConsultaAutorizada(Number(req.params.id), req.usuario);
    const [t, datos] = await Promise.all([
        query('SELECT * FROM tratamientos WHERE id_consulta = $1 ORDER BY id_tratamiento', [consulta.id_consulta]),
        query(
            `SELECT h.numero AS numero_historia,
                    (SELECT u.nombre || ' ' || u.apellido FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
                      WHERE v.id_veterinario = $2) AS nombre_veterinario,
                    (SELECT v.tarjeta_profesional FROM veterinarios v WHERE v.id_veterinario = $2) AS tarjeta_veterinario,
                    json_build_object(
                      'id_mascota', m.id_mascota, 'nombre', m.nombre, 'especie', m.especie, 'raza', m.raza,
                      'sexo', m.sexo, 'fecha_nacimiento', m.fecha_nacimiento, 'peso_kg', m.peso_kg,
                      'color', m.color, 'esterilizado', m.esterilizado, 'microchip', m.microchip, 'foto', m.foto) AS mascota,
                    json_build_object(
                      'nombre', u.nombre, 'apellido', u.apellido, 'correo', u.correo,
                      'tipo_documento', p.tipo_documento, 'numero_documento', p.numero_documento,
                      'telefono', p.telefono, 'direccion', p.direccion) AS propietario
               FROM historias_clinicas h
               JOIN mascotas m ON m.id_mascota = h.id_mascota
               JOIN propietarios p ON p.id_propietario = m.id_propietario
               JOIN usuarios u ON u.id_usuario = p.id_usuario
              WHERE h.id_historia = $1`,
            [consulta.id_historia, consulta.id_veterinario]
        ),
    ]);
    res.json({
        ...consulta,
        ...datos.rows[0],
        tratamientos: t.rows,
        // Solo el veterinario que registró la consulta la puede editar
        puede_editar: Boolean(req.usuario.id_veterinario) && req.usuario.id_veterinario === consulta.id_veterinario,
    });
}

// GET /api/consultas?q=&id_mascota=&desde=&hasta=&pagina=&limite=
// Ep3-Hu13: todas las consultas (la más reciente primero). El propietario solo ve las de sus mascotas.
async function listarTodasConsultas(req, res) {
    const pag = paginar(req);
    const parametros = [];
    const condiciones = ['TRUE'];
    const agregar = (sql, valor) => {
        parametros.push(valor);
        condiciones.push(sql.replaceAll('?', `$${parametros.length}`));
    };
    if (!esPersonal(req.usuario)) agregar('m.id_propietario = ?', req.usuario.id_propietario);
    if (req.query.id_mascota) agregar('m.id_mascota = ?', Number(req.query.id_mascota) || 0);
    if (req.query.q) agregar('(m.nombre ILIKE ? OR c.motivo ILIKE ? OR c.diagnostico ILIKE ?)', `%${req.query.q}%`);
    for (const [campo, sql] of [['desde', 'c.fecha >= ?::date'], ['hasta', 'c.fecha < (?::date + 1)']]) {
        if (!req.query[campo]) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query[campo])) {
            throw new ErrorHttp(400, `El filtro «${campo}» debe tener el formato AAAA-MM-DD`);
        }
        agregar(sql, req.query[campo]);
    }

    const desde = `FROM consultas c
                   JOIN historias_clinicas h ON h.id_historia = c.id_historia
                   JOIN mascotas m ON m.id_mascota = h.id_mascota
                   JOIN propietarios p ON p.id_propietario = m.id_propietario
                   JOIN usuarios u ON u.id_usuario = p.id_usuario
                  WHERE ${condiciones.join(' AND ')}`;
    const total = (await query(`SELECT count(*)::int AS n ${desde}`, parametros)).rows[0].n;
    const { rows } = await query(
        `SELECT c.id_consulta, c.fecha, c.motivo, c.diagnostico, c.id_veterinario, c.proximo_control,
                ${NOMBRE_VETERINARIO},
                h.id_historia, h.numero AS numero_historia,
                m.id_mascota, m.nombre AS nombre_mascota, m.especie, m.foto,
                u.nombre || ' ' || u.apellido AS nombre_propietario,
                (SELECT count(*)::int FROM tratamientos t WHERE t.id_consulta = c.id_consulta) AS total_tratamientos
           ${desde}
          ORDER BY c.fecha DESC, c.id_consulta DESC
          LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
        [...parametros, pag.limite, pag.offset]
    );
    res.json(respuestaPaginada(rows, total, pag));
}

// PUT /api/consultas/:id   (solo el veterinario que la registró)
async function actualizarConsulta(req, res) {
    const consulta = await obtenerConsultaAutorizada(Number(req.params.id), req.usuario);
    if (consulta.id_veterinario !== req.usuario.id_veterinario) {
        throw sinPermiso('Solo el veterinario que registró la consulta puede modificarla');
    }
    const { text, values } = construirUpdate('consultas', 'id_consulta', consulta.id_consulta, req.body);
    const { rows } = await query(text, values);
    res.json(rows[0]);
}

// ------------------------------------------------------------------
//  Tratamientos
// ------------------------------------------------------------------

// GET /api/historias/:id/tratamientos?estado=activo
async function listarTratamientos(req, res) {
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);
    const parametros = [historia.id_historia];
    let filtro = '';
    if (req.query.estado) { parametros.push(req.query.estado); filtro = ' AND t.estado = $2::estado_tratamiento'; }
    const { rows } = await query(
        `SELECT t.*, c.fecha AS fecha_consulta, c.diagnostico
           FROM tratamientos t JOIN consultas c ON c.id_consulta = t.id_consulta
          WHERE c.id_historia = $1 ${filtro} ORDER BY t.fecha_inicio DESC`,
        parametros
    );
    res.json(rows);
}

// POST /api/consultas/:id/tratamientos   (veterinario)
async function crearTratamiento(req, res) {
    const consulta = await obtenerConsultaAutorizada(Number(req.params.id), req.usuario);
    const { text, values } = construirInsert('tratamientos', { ...req.body, id_consulta: consulta.id_consulta });
    const { rows } = await query(text, values);
    res.status(201).json(rows[0]);
}

async function obtenerTratamientoAutorizado(idTratamiento, usuario) {
    const { rows } = await query(
        `SELECT t.*, c.id_historia FROM tratamientos t
           JOIN consultas c ON c.id_consulta = t.id_consulta WHERE t.id_tratamiento = $1`,
        [idTratamiento]
    );
    if (!rows[0]) throw noEncontrado('Tratamiento');
    await obtenerHistoriaAutorizada(rows[0].id_historia, usuario);
    return rows[0];
}

// PUT /api/tratamientos/:id   (veterinario) p. ej. {"estado": "finalizado"}
async function actualizarTratamiento(req, res) {
    const t = await obtenerTratamientoAutorizado(Number(req.params.id), req.usuario);
    const inicio = req.body.fecha_inicio ?? t.fecha_inicio;
    if (req.body.fecha_fin && inicio && req.body.fecha_fin < inicio) {
        throw new ErrorHttp(400, 'fecha_fin no puede ser anterior a fecha_inicio');
    }
    const { text, values } = construirUpdate('tratamientos', 'id_tratamiento', t.id_tratamiento, req.body);
    const { rows } = await query(text, values);
    // Ep5-Hu3: un tratamiento finalizado o suspendido deja de generar recordatorios
    if (rows[0].estado !== 'activo') await sinRomper(() => cancelarRecordatoriosTratamiento(t.id_tratamiento));
    res.json(rows[0]);
}

// ------------------------------------------------------------------
//  Evolución del tratamiento (la registra el propietario)
// ------------------------------------------------------------------

// GET /api/tratamientos/:id/evoluciones
async function listarEvoluciones(req, res) {
    const t = await obtenerTratamientoAutorizado(Number(req.params.id), req.usuario);
    const { rows } = await query(
        'SELECT * FROM evoluciones_tratamiento WHERE id_tratamiento = $1 ORDER BY fecha DESC',
        [t.id_tratamiento]
    );
    res.json(rows);
}

// POST /api/tratamientos/:id/evoluciones   (propietario dueño de la mascota)
async function crearEvolucion(req, res) {
    const t = await obtenerTratamientoAutorizado(Number(req.params.id), req.usuario);
    if (t.estado !== 'activo') throw new ErrorHttp(409, 'Solo se puede registrar evolución en tratamientos activos');
    const { estado_general, dosis_aplicada, descripcion } = req.body;
    const { rows } = await query(
        `INSERT INTO evoluciones_tratamiento (id_tratamiento, id_usuario, estado_general, dosis_aplicada, descripcion)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [t.id_tratamiento, req.usuario.id_usuario, estado_general, dosis_aplicada, descripcion]
    );
    res.status(201).json(rows[0]);
}

// ------------------------------------------------------------------
//  Vacunas
// ------------------------------------------------------------------

// GET /api/historias/:id/vacunas   carné de vacunación (orden cronológico)
async function listarVacunas(req, res) {
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);
    const { rows } = await query(`${SELECT_VACUNA} WHERE va.id_historia = $1 ${ORDEN_CARNE}`, [historia.id_historia]);
    res.json(rows);
}

/** Si se eligió una vacuna del catálogo, toma su nombre y revisa que sirva para la especie. */
async function resolverCatalogo(datos, idHistoria) {
    if (!datos.id_catalogo) return datos;
    const { rows } = await query(
        `SELECT cv.*, m.especie AS especie_mascota
           FROM catalogo_vacunas cv, historias_clinicas h JOIN mascotas m ON m.id_mascota = h.id_mascota
          WHERE cv.id_catalogo = $1 AND h.id_historia = $2`,
        [datos.id_catalogo, idHistoria]
    );
    const vacuna = rows[0];
    if (!vacuna || !vacuna.activo) {
        throw new ErrorHttp(400, 'Datos inválidos', [{ campo: 'id_catalogo', mensaje: 'La vacuna no existe en el catálogo' }]);
    }
    if (vacuna.especie && vacuna.especie !== vacuna.especie_mascota) {
        throw new ErrorHttp(400, 'Datos inválidos', [{
            campo: 'id_catalogo', mensaje: `La vacuna ${vacuna.nombre} es para la especie ${vacuna.especie}`,
        }]);
    }
    return { ...datos, nombre: vacuna.nombre };
}

const vacunaPorId = async (id) => (await query(`${SELECT_VACUNA} WHERE va.id_vacuna = $1`, [id])).rows[0];

// POST /api/historias/:id/vacunas   (veterinario)
async function crearVacuna(req, res) {
    exigirPerfilVeterinario(req.usuario);
    const historia = await obtenerHistoriaAutorizada(Number(req.params.id), req.usuario);
    const datos = await resolverCatalogo(req.body, historia.id_historia);
    const { text, values } = construirInsert('vacunas', {
        ...datos, id_historia: historia.id_historia, id_veterinario: req.usuario.id_veterinario,
    });
    const { rows } = await query(text, values);
    // Ep5-Hu2: recordatorio de la próxima dosis (y se cierra el del registro anterior de la misma vacuna)
    await sinRomper(() => sincronizarVacunasRelacionadas(rows[0].id_vacuna));
    res.status(201).json(await vacunaPorId(rows[0].id_vacuna));
}

// PUT /api/vacunas/:id   (veterinario) corrige un registro ingresado por error
async function actualizarVacuna(req, res) {
    exigirPerfilVeterinario(req.usuario);
    const actual = await vacunaPorId(Number(req.params.id));
    if (!actual) throw noEncontrado('Vacuna');

    // Se valida con las fechas finales (las que llegan + las que ya estaban guardadas)
    const aplicacion = req.body.fecha_aplicacion ?? actual.fecha_aplicacion;
    const proxima = 'proxima_dosis' in req.body ? req.body.proxima_dosis : actual.proxima_dosis;
    if (proxima && proxima <= aplicacion) {
        throw new ErrorHttp(400, 'Datos inválidos', [{
            campo: 'proxima_dosis', mensaje: 'La próxima dosis debe ser posterior a la fecha de aplicación',
        }]);
    }

    const cambios = await resolverCatalogo(req.body, actual.id_historia);
    const { text, values } = construirUpdate('vacunas', 'id_vacuna', actual.id_vacuna, cambios);
    await query(text, values);
    // Ep5-Hu2: si cambió la próxima dosis, se actualiza el recordatorio
    await sinRomper(() => sincronizarVacunasRelacionadas(actual.id_vacuna));
    res.json(await vacunaPorId(actual.id_vacuna));
}

// GET /api/vacunas/catalogo?especie=   vacunas disponibles (solo las activas)
async function listarCatalogo(req, res) {
    const especie = typeof req.query.especie === 'string' ? req.query.especie.toLowerCase() : null;
    const { rows } = await query(
        `SELECT id_catalogo, nombre, especie, descripcion, dias_refuerzo
           FROM catalogo_vacunas
          WHERE activo AND ($1::text IS NULL OR especie IS NULL OR especie = $1)
          ORDER BY nombre`,
        [especie]
    );
    res.json(rows);
}

module.exports = {
    obtenerPorMascota, obtener, actualizar,
    listarConsultas, crearConsulta, obtenerConsulta, actualizarConsulta, listarTodasConsultas,
    listarTratamientos, crearTratamiento, actualizarTratamiento,
    listarEvoluciones, crearEvolucion,
    listarVacunas, crearVacuna, actualizarVacuna, listarCatalogo,
};
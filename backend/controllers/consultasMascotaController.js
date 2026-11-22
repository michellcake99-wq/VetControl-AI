// Ep3-Hu9: listados de consultas y tratamientos a partir de la mascota
// (los listados por historia clínica ya existen en historiasController.js)
// Ep4-Hu2: historial médico cronológico (consultas + tratamientos + vacunas)
const { query } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');
const { obtenerMascotaAutorizada } = require('../utils/acceso');

const ESTADOS_TRATAMIENTO = ['activo', 'finalizado', 'suspendido'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

async function historiaDeMascota(req) {
  const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
  const { rows } = await query('SELECT id_historia FROM historias_clinicas WHERE id_mascota = $1', [mascota.id_mascota]);
  if (!rows[0]) throw noEncontrado('Historia clínica');
  return rows[0].id_historia;
}

// GET /api/mascotas/:id/consultas?desde=&hasta=&pagina=&limite=
async function listarConsultas(req, res) {
  const idHistoria = await historiaDeMascota(req);
  const pag = paginar(req);
  const parametros = [idHistoria];
  let filtro = '';
  for (const [campo, sql] of [['desde', 'c.fecha >= $?::date'], ['hasta', 'c.fecha < ($?::date + 1)']]) {
    const valor = req.query[campo];
    if (!valor) continue;
    if (!FECHA.test(valor)) throw new ErrorHttp(400, `El filtro «${campo}» debe tener el formato AAAA-MM-DD`);
    parametros.push(valor);
    filtro += ` AND ${sql.replace('?', parametros.length)}`;
  }

  const total = (await query(`SELECT count(*)::int AS n FROM consultas c WHERE c.id_historia = $1 ${filtro}`, parametros)).rows[0].n;
  const { rows } = await query(
    `SELECT c.*,
            (SELECT u.nombre || ' ' || u.apellido FROM veterinarios v
               JOIN usuarios u ON u.id_usuario = v.id_usuario
              WHERE v.id_veterinario = c.id_veterinario) AS nombre_veterinario,
            (SELECT count(*)::int FROM tratamientos t WHERE t.id_consulta = c.id_consulta) AS total_tratamientos
     FROM consultas c
     WHERE c.id_historia = $1 ${filtro}
     ORDER BY c.fecha DESC
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    [...parametros, pag.limite, pag.offset]
  );
  res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/mascotas/:id/tratamientos?estado=activo|finalizado|suspendido
async function listarTratamientos(req, res) {
  const idHistoria = await historiaDeMascota(req);
  const { estado } = req.query;
  if (estado && !ESTADOS_TRATAMIENTO.includes(estado)) {
    throw new ErrorHttp(400, `Estado inválido (use ${ESTADOS_TRATAMIENTO.join(', ')})`);
  }
  const parametros = [idHistoria];
  if (estado) parametros.push(estado);
  const { rows } = await query(
    `SELECT t.*, c.fecha AS fecha_consulta, c.diagnostico
     FROM tratamientos t JOIN consultas c ON c.id_consulta = t.id_consulta
     WHERE c.id_historia = $1 ${estado ? 'AND t.estado = $2::estado_tratamiento' : ''}
     ORDER BY t.fecha_inicio DESC, t.id_tratamiento DESC`,
    parametros
  );
  res.json(rows);
}

// ------------------------------------------------------------------
//  Ep4-Hu2: historial médico cronológico de la mascota
// ------------------------------------------------------------------
const TIPOS_HISTORIAL = ['consulta', 'tratamiento', 'vacuna'];
const ZONA = 'America/Bogota';

// Cada registro del historial queda con la misma forma, sea consulta, tratamiento o vacuna.
// «fecha» es el día del evento (día de la consulta, inicio del tratamiento o aplicación de la vacuna).
const EVENTOS_SQL = `
  SELECT 'consulta'::text AS tipo, c.id_consulta AS id,
         (c.fecha AT TIME ZONE '${ZONA}')::date AS fecha, c.fecha AS momento,
         c.motivo AS titulo, c.diagnostico AS detalle, NULL::text AS estado, c.id_consulta,
         jsonb_build_object(
           'veterinario', (SELECT u.nombre || ' ' || u.apellido FROM veterinarios v
                             JOIN usuarios u ON u.id_usuario = v.id_usuario
                            WHERE v.id_veterinario = c.id_veterinario),
           'observaciones', c.observaciones,
           'proximo_control', c.proximo_control,
           'total_tratamientos', (SELECT count(*)::int FROM tratamientos t WHERE t.id_consulta = c.id_consulta)
         ) AS extra
    FROM consultas c WHERE c.id_historia = $1
  UNION ALL
  SELECT 'tratamiento', t.id_tratamiento,
         t.fecha_inicio, t.fecha_registro,
         t.medicamento, concat_ws(' · ', t.dosis, t.frecuencia, t.via), t.estado::text, t.id_consulta,
         jsonb_build_object('fecha_fin', t.fecha_fin, 'indicaciones', t.indicaciones, 'diagnostico', c.diagnostico)
    FROM tratamientos t JOIN consultas c ON c.id_consulta = t.id_consulta WHERE c.id_historia = $1
  UNION ALL
  SELECT 'vacuna', v.id_vacuna,
         v.fecha_aplicacion, v.fecha_registro,
         v.nombre, NULL::text, NULL::text, NULL::int,
         jsonb_build_object(
           'laboratorio', v.laboratorio, 'lote', v.lote, 'proxima_dosis', v.proxima_dosis,
           'observaciones', v.observaciones,
           'veterinario', (SELECT u.nombre || ' ' || u.apellido FROM veterinarios vt
                             JOIN usuarios u ON u.id_usuario = vt.id_usuario
                            WHERE vt.id_veterinario = v.id_veterinario)
         )
    FROM vacunas v WHERE v.id_historia = $1`;

function fechaValida(valor) {
  if (!FECHA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

// GET /api/mascotas/:id/historial?tipo=consulta|tratamiento|vacuna&desde=&hasta=&orden=desc|asc&pagina=&limite=
// Solo lectura. El propietario solo puede consultar el de sus mascotas (lo controla obtenerMascotaAutorizada).
async function historial(req, res) {
  const mascota = await obtenerMascotaAutorizada(Number(req.params.id), req.usuario);
  const { tipo, desde, hasta } = req.query;
  const orden = req.query.orden === 'asc' ? 'ASC' : 'DESC';

  if (tipo && !TIPOS_HISTORIAL.includes(tipo)) {
    throw new ErrorHttp(400, `Tipo inválido (use ${TIPOS_HISTORIAL.join(', ')})`);
  }
  for (const [campo, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor && !fechaValida(valor)) throw new ErrorHttp(400, `El filtro «${campo}» debe ser una fecha válida (AAAA-MM-DD)`);
  }
  if (desde && hasta && desde > hasta) {
    throw new ErrorHttp(400, 'La fecha «desde» no puede ser posterior a la fecha «hasta»');
  }

  const pag = paginar(req);
  const respuesta = (datos, resumen) => ({
    mascota: { id_mascota: mascota.id_mascota, nombre: mascota.nombre, especie: mascota.especie },
    resumen,
    ...respuestaPaginada(datos, tipo ? resumen[tipo] : resumen.consulta + resumen.tratamiento + resumen.vacuna, pag),
  });
  const sinRegistros = { consulta: 0, tratamiento: 0, vacuna: 0 };

  const historia = (await query('SELECT id_historia FROM historias_clinicas WHERE id_mascota = $1', [mascota.id_mascota])).rows[0];
  if (!historia) return res.json(respuesta([], sinRegistros));

  // Filtro de fechas (se aplica a todos los tipos); el tipo se filtra aparte para poder dar el resumen
  const parametros = [historia.id_historia];
  let filtroFecha = '';
  if (desde) { parametros.push(desde); filtroFecha += ` AND fecha >= $${parametros.length}::date`; }
  if (hasta) { parametros.push(hasta); filtroFecha += ` AND fecha <= $${parametros.length}::date`; }

  const conteo = await query(
    `WITH eventos AS (${EVENTOS_SQL})
     SELECT tipo, count(*)::int AS n FROM eventos WHERE true ${filtroFecha} GROUP BY tipo`,
    parametros
  );
  const resumen = { ...sinRegistros };
  for (const fila of conteo.rows) resumen[fila.tipo] = fila.n;

  const parametrosLista = [...parametros];
  let filtroTipo = '';
  if (tipo) { parametrosLista.push(tipo); filtroTipo = ` AND tipo = $${parametrosLista.length}`; }
  const { rows } = await query(
    `WITH eventos AS (${EVENTOS_SQL})
     SELECT tipo, id, fecha, momento, titulo, detalle, estado, id_consulta, extra
       FROM eventos WHERE true ${filtroFecha}${filtroTipo}
      ORDER BY fecha ${orden}, momento ${orden}, id ${orden}
      LIMIT $${parametrosLista.length + 1} OFFSET $${parametrosLista.length + 2}`,
    [...parametrosLista, pag.limite, pag.offset]
  );
  res.json(respuesta(rows, resumen));
}

module.exports = { listarConsultas, listarTratamientos, historial };
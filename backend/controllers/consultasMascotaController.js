// Ep3-Hu9: listados de consultas y tratamientos a partir de la mascota
// (los listados por historia clínica ya existen en historiasController.js)
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

module.exports = { listarConsultas, listarTratamientos };

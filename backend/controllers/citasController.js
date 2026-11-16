const { query, enTransaccion, construirInsert } = require('../utils/baseDatos');
const { ErrorHttp, noEncontrado, sinPermiso } = require('../utils/errores');
const { paginar, respuestaPaginada } = require('../utils/paginacion');
const { obtenerMascotaAutorizada } = require('../utils/acceso');

// Las citas se agendan en hora de Colombia/Ecuador (UTC-5, sin horario de verano)
const ZONA = 'America/Bogota';
// Clave del bloqueo por veterinario (evita que dos solicitudes simultáneas se crucen)
const BLOQUEO_CITAS = 7001;

const SELECT_CITA = `
  SELECT c.*, m.nombre AS nombre_mascota, m.id_propietario,
         uo.nombre || ' ' || uo.apellido AS nombre_propietario,
         uv.nombre || ' ' || uv.apellido AS nombre_veterinario
  FROM citas c
  JOIN mascotas m ON m.id_mascota = c.id_mascota
  JOIN propietarios p ON p.id_propietario = m.id_propietario
  JOIN usuarios uo ON uo.id_usuario = p.id_usuario
  JOIN veterinarios v ON v.id_veterinario = c.id_veterinario
  JOIN usuarios uv ON uv.id_usuario = v.id_usuario`;

// Quién puede pasar una cita de un estado a otro (estado actual -> nuevo estado -> roles)
const PERSONAL = ['veterinario', 'administrador'];
const TODOS = ['propietario', 'veterinario', 'administrador'];
// Ep3-Hu14: el veterinario confirma la cita solicitada («programada» -> «confirmada»)
const ACTIVA = { atendida: PERSONAL, cancelada: TODOS, no_asistio: PERSONAL };
const TRANSICIONES = {
  programada: { confirmada: PERSONAL, ...ACTIVA },
  reprogramada: { confirmada: PERSONAL, ...ACTIVA },
  confirmada: ACTIVA,
};
// Estados que ocupan el horario del veterinario
const ESTADOS_ACTIVOS = "('programada', 'confirmada', 'reprogramada')";

const hora = (fecha) =>
  new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA }).format(new Date(fecha));

async function buscarCita(idCita) {
  const { rows } = await query(`${SELECT_CITA} WHERE c.id_cita = $1`, [idCita]);
  if (!rows[0]) throw noEncontrado('Cita');
  return rows[0];
}

/** El propietario solo ve las citas de sus mascotas y el veterinario solo las de su agenda. */
function verificarAcceso(cita, usuario) {
  if (usuario.rol === 'propietario' && cita.id_propietario !== usuario.id_propietario) throw sinPermiso();
  if (usuario.rol === 'veterinario' && cita.id_veterinario !== usuario.id_veterinario) throw sinPermiso();
}

async function verificarVeterinarioActivo(idVeterinario) {
  const { rows } = await query(
    `SELECT u.activo FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
     WHERE v.id_veterinario = $1`,
    [idVeterinario]
  );
  if (!rows[0] || !rows[0].activo) throw new ErrorHttp(400, 'El veterinario indicado no existe o está desactivado');
}

// POST /api/citas
async function crear(req, res) {
  const { id_mascota, id_veterinario, fecha_hora, duracion_min, motivo, tipo_consulta } = req.body;

  // El propietario solo agenda para sus mascotas (403) y un veterinario solo en su propia agenda
  const mascota = await obtenerMascotaAutorizada(id_mascota, req.usuario);
  if (!mascota.activo) throw new ErrorHttp(400, 'La mascota indicada está desactivada');
  if (req.usuario.rol === 'veterinario' && id_veterinario !== req.usuario.id_veterinario) {
    throw sinPermiso('Un veterinario solo puede agendar citas en su propia agenda');
  }
  await verificarVeterinarioActivo(id_veterinario);

  const idCita = await enTransaccion(async (cliente) => {
    // Un solo agendamiento a la vez por veterinario: la revisión y el INSERT no se pueden intercalar
    await cliente.query('SELECT pg_advisory_xact_lock($1, $2)', [BLOQUEO_CITAS, id_veterinario]);

    const cruce = await cliente.query(
      `SELECT fecha_hora, duracion_min FROM citas
       WHERE id_veterinario = $1
         AND estado IN ${ESTADOS_ACTIVOS}
         AND fecha_hora < $2::timestamptz + ($3::int * interval '1 minute')
         AND fecha_hora + (duracion_min * interval '1 minute') > $2::timestamptz
       ORDER BY fecha_hora LIMIT 1`,
      [id_veterinario, fecha_hora, duracion_min]
    );
    if (cruce.rows[0]) {
      const inicio = cruce.rows[0].fecha_hora;
      const fin = new Date(inicio.getTime() + cruce.rows[0].duracion_min * 60000);
      const mensaje = `El veterinario ya tiene una cita en ese horario (ocupado de ${hora(inicio)} a ${hora(fin)}). Elija otra hora.`;
      throw new ErrorHttp(409, mensaje, [{ campo: 'fecha_hora', mensaje }]);
    }

    // La cita que pide el propietario nace «programada» (solicitada) y espera confirmación;
    // la que agenda el personal de la clínica (veterinario o administrador) nace ya «confirmada».
    const estado = req.usuario.rol === 'propietario' ? 'programada' : 'confirmada';
    const { text, values } = construirInsert(
      'citas',
      { id_mascota, id_veterinario, fecha_hora, duracion_min, motivo, tipo_consulta, estado },
      'id_cita'
    );
    return (await cliente.query(text, values)).rows[0].id_cita;
  });

  res.status(201).json(await buscarCita(idCita));
}

// GET /api/citas?estado=&desde=&hasta=&id_mascota=&id_veterinario=&orden=&pagina=&limite=
async function listar(req, res) {
  const pag = paginar(req);
  const parametros = [];
  const condiciones = [];
  // "?" se reemplaza por el número de parámetro ($n) del valor agregado
  const agregar = (sql, valor) => {
    parametros.push(valor);
    condiciones.push(sql.replaceAll('?', `$${parametros.length}`));
  };

  // El alcance depende del rol: propietario = sus mascotas, veterinario = su agenda, administrador = todo
  if (req.usuario.rol === 'propietario') agregar('m.id_propietario = ?', req.usuario.id_propietario);
  if (req.usuario.rol === 'veterinario') agregar('c.id_veterinario = ?', req.usuario.id_veterinario);

  const { estado, desde, hasta, id_mascota, id_veterinario, orden } = req.query;
  if (estado) agregar('c.estado = ?::estado_cita', estado);
  if (desde) agregar(`c.fecha_hora >= (?::date)::timestamp AT TIME ZONE '${ZONA}'`, desde);
  if (hasta) agregar(`c.fecha_hora < ((?::date) + 1)::timestamp AT TIME ZONE '${ZONA}'`, hasta);
  if (id_mascota) agregar('c.id_mascota = ?', Number(id_mascota));
  if (id_veterinario) agregar('c.id_veterinario = ?', Number(id_veterinario));

  const filtro = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const total = (await query(
    `SELECT count(*)::int AS n FROM citas c JOIN mascotas m ON m.id_mascota = c.id_mascota ${filtro}`,
    parametros
  )).rows[0].n;
  const { rows } = await query(
    `${SELECT_CITA} ${filtro}
     ORDER BY c.fecha_hora ${orden === 'desc' ? 'DESC' : 'ASC'}
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    [...parametros, pag.limite, pag.offset]
  );
  res.json(respuestaPaginada(rows, total, pag));
}

// GET /api/citas/veterinarios — veterinarios activos a los que se les puede pedir cita (Ep3-Hu14)
// es_yo indica cuál es el veterinario que consulta (para agendar en su propia agenda)
async function listarVeterinarios(req, res) {
  const { rows } = await query(
    `SELECT v.id_veterinario, u.nombre, u.apellido, v.especialidad,
            v.id_veterinario IS NOT DISTINCT FROM $1 AS es_yo
       FROM veterinarios v JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE u.activo
      ORDER BY u.nombre, u.apellido`,
    [req.usuario.id_veterinario ?? null]
  );
  res.json(rows);
}

// GET /api/citas/ocupados?id_veterinario=&fecha=AAAA-MM-DD
// Horarios ya tomados de un veterinario en un día (sin datos de otras personas) (Ep3-Hu14)
async function listarOcupados(req, res) {
  const { id_veterinario, fecha } = req.query;
  const { rows } = await query(
    `SELECT fecha_hora AS inicio, fecha_hora + (duracion_min * interval '1 minute') AS fin
       FROM citas
      WHERE id_veterinario = $1
        AND estado IN ${ESTADOS_ACTIVOS}
        AND fecha_hora >= ($2::date)::timestamp AT TIME ZONE '${ZONA}'
        AND fecha_hora <  (($2::date) + 1)::timestamp AT TIME ZONE '${ZONA}'
      ORDER BY fecha_hora`,
    [id_veterinario, fecha]
  );
  res.json(rows);
}

// GET /api/citas/:id
async function obtener(req, res) {
  const cita = await buscarCita(Number(req.params.id));
  verificarAcceso(cita, req.usuario);
  res.json(cita);
}

// PUT /api/citas/:id/estado  {"estado": "atendida", "observaciones": "..."}
async function cambiarEstado(req, res) {
  const cita = await buscarCita(Number(req.params.id));
  verificarAcceso(cita, req.usuario);

  const { estado, observaciones } = req.body;
  const roles = TRANSICIONES[cita.estado]?.[estado];
  if (!roles) {
    throw new ErrorHttp(409, `No se puede pasar una cita de «${cita.estado}» a «${estado}»`);
  }
  if (!roles.includes(req.usuario.rol)) {
    throw sinPermiso(`Su rol no puede cambiar una cita a «${estado}»`);
  }

  // "AND estado = ..." evita que dos cambios simultáneos se pisen
  const { rowCount } = await query(
    `UPDATE citas SET estado = $1, observaciones = COALESCE($2, observaciones)
     WHERE id_cita = $3 AND estado = $4`,
    [estado, observaciones ?? null, cita.id_cita, cita.estado]
  );
  if (!rowCount) throw new ErrorHttp(409, 'La cita cambió de estado mientras la actualizaba; vuelva a consultarla');
  res.json(await buscarCita(cita.id_cita));
}

module.exports = { crear, listar, obtener, cambiarEstado, listarVeterinarios, listarOcupados };
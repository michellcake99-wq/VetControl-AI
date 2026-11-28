import { useEffect, useMemo, useState } from 'react';
import {
  Bandage,
  ClipboardCheck,
  HeartPulse,
  MoreHorizontal,
  Scissors,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { lista } from '../utils/consultas.js';
import {
  diaClinica,
  diaLargo,
  fechaHoraClinica,
  HORAS_DEL_DIA,
  horaLegible,
  TIPOS_CONSULTA,
} from '../utils/citas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import BotonVolver from '../components/BotonVolver.jsx';

const DURACIONES = [15, 30, 45, 60, 90, 120];

// Ícono de cada tipo de consulta
const ICONOS_TIPO = {
  consulta_general: Stethoscope,
  vacunacion: Syringe,
  control: ClipboardCheck,
  desparasitacion: Bandage,
  cirugia: Scissors,
  urgencia: HeartPulse,
  otro: MoreHorizontal,
};

/**
 * Ep3-Hu14: formulario para solicitar (propietario) o agendar (veterinario / administrador) una cita.
 * - No deja elegir fechas ni horas pasadas.
 * - Muestra en rojo las horas que el veterinario ya tiene ocupadas ese día.
 * - Si el servidor responde que el horario está ocupado (409), lo indica junto a la hora.
 */
export default function CitaFormulario() {
  const rol = rolActual();
  const esPropietario = rol === 'propietario';
  const esVeterinario = rol === 'veterinario';
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const hoy = diaClinica(new Date());

  const [mascotas, setMascotas] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [valores, setValores] = useState({
    id_mascota: parametros.get('mascota') ?? '',
    id_veterinario: '',
    fecha: hoy,
    hora: '',
    duracion_min: 30,
    tipo_consulta: '',
    motivo: '',
  });
  const [ocupados, setOcupados] = useState([]);
  const [cargandoHoras, setCargandoHoras] = useState(true);
  const [recargarHoras, setRecargarHoras] = useState(0);
  // Hora actual (se actualiza cada minuto para bloquear las horas que van pasando)
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(reloj);
  }, []);

  // Mascotas (el propietario solo recibe las suyas) y veterinarios activos
  useEffect(() => {
    let cancelado = false;
    Promise.all([
      api.get('/mascotas?limite=100'),
      api.get('/citas/veterinarios'),
    ])
      .then(([rMascotas, rVeterinarios]) => {
        if (cancelado) return;
        const activas = lista(rMascotas).filter((m) => m.activo !== false);
        setMascotas(activas);
        setVeterinarios(rVeterinarios);
        // El veterinario solo agenda en su propia agenda
        const yo = rVeterinarios.find((v) => v.es_yo);
        setValores((v) => ({
          ...v,
          id_mascota:
            v.id_mascota ||
            (activas.length === 1 ? String(activas[0].id_mascota) : ''),
          id_veterinario: yo ? String(yo.id_veterinario) : v.id_veterinario,
        }));
      })
      .catch((err) => {
        if (!cancelado)
          setErrorGeneral(err.message || 'No se pudieron cargar los datos.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Horarios ocupados del veterinario en el día elegido
  useEffect(() => {
    if (!valores.id_veterinario || !valores.fecha) return undefined;
    let cancelado = false;
    api
      .get(
        `/citas/ocupados?id_veterinario=${valores.id_veterinario}&fecha=${valores.fecha}`
      )
      .then((r) => {
        if (!cancelado) setOcupados(r);
      })
      .catch(() => {
        if (!cancelado) setOcupados([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoHoras(false);
      });
    return () => {
      cancelado = true;
    };
  }, [valores.id_veterinario, valores.fecha, recargarHoras]);

  // Estado de cada hora del día: libre, ocupada o pasada
  const horas = useMemo(() => {
    const duracion = Number(valores.duracion_min) * 60000;
    return HORAS_DEL_DIA.map((hora) => {
      const inicio = new Date(fechaHoraClinica(valores.fecha, hora)).getTime();
      if (inicio <= ahora) return { hora, estado: 'pasada' };
      const cruza = ocupados.some(
        (o) =>
          inicio < new Date(o.fin).getTime() &&
          inicio + duracion > new Date(o.inicio).getTime()
      );
      return { hora, estado: cruza ? 'ocupada' : 'libre' };
    });
  }, [valores.fecha, valores.duracion_min, ocupados, ahora]);

  function cambiar(campo, valor) {
    setValores((v) => {
      const nuevos = { ...v, [campo]: valor };
      // Al cambiar el día, el veterinario o la duración, la hora elegida puede dejar de servir
      if (['fecha', 'id_veterinario', 'duracion_min'].includes(campo))
        nuevos.hora = '';
      return nuevos;
    });
    if (['fecha', 'id_veterinario'].includes(campo)) setCargandoHoras(true);
    setErrores((e) => ({
      ...e,
      [campo]: undefined,
      ...(campo !== 'motivo' && { hora: undefined }),
    }));
  }

  function validar() {
    const e = {};
    if (!valores.id_mascota) e.id_mascota = 'Elige la mascota.';
    if (!valores.id_veterinario) e.id_veterinario = 'Elige el veterinario.';
    if (!valores.fecha) e.fecha = 'Elige el día.';
    else if (valores.fecha < hoy)
      e.fecha = 'No puedes elegir una fecha pasada.';
    if (!valores.hora) e.hora = 'Elige una hora disponible.';
    else if (
      new Date(fechaHoraClinica(valores.fecha, valores.hora)) <= new Date()
    )
      e.hora = 'Esa hora ya pasó. Elige otra.';
    if (!valores.tipo_consulta) e.tipo_consulta = 'Elige el tipo de consulta.';
    if (!valores.motivo.trim()) e.motivo = 'Escribe el motivo de la cita.';
    else if (valores.motivo.trim().length > 200)
      e.motivo = 'Máximo 200 caracteres.';
    return e;
  }

  async function guardar(evento) {
    evento.preventDefault();
    setErrorGeneral('');
    const encontrados = validar();
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setGuardando(true);
    try {
      const cita = await api.post('/citas', {
        id_mascota: Number(valores.id_mascota),
        id_veterinario: Number(valores.id_veterinario),
        fecha_hora: fechaHoraClinica(valores.fecha, valores.hora),
        // La duración la define el tipo de consulta; solo el personal puede ajustarla
        ...(esPropietario
          ? {}
          : { duracion_min: Number(valores.duracion_min) }),
        motivo: valores.motivo.trim(),
        tipo_consulta: valores.tipo_consulta,
      });
      navigate('/citas', {
        state: {
          mensaje: `${esPropietario ? 'Cita solicitada' : 'Cita agendada y confirmada'}: ${cita.nombre_mascota} con ${cita.nombre_veterinario}, ${diaLargo(cita.fecha_hora)} a las ${horaLegible(valores.hora)}`,
        },
      });
    } catch (err) {
      const delServidor = {};
      for (const d of err.detalles ?? []) {
        const campo = d.campo === 'fecha_hora' ? 'hora' : d.campo.split('.')[0];
        delServidor[campo] ??= d.mensaje;
      }
      if (err.estado === 409) {
        // Otra persona tomó ese horario: se marca y se recargan las horas ocupadas
        delServidor.hora ??= err.message;
        setRecargarHoras((n) => n + 1);
      }
      setErrores(delServidor);
      if (!Object.keys(delServidor).length)
        setErrorGeneral(err.message || 'No se pudo guardar la cita.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <CargandoInline texto="Cargando…" />;

  const clase = (campo) => `campo${errores[campo] ? ' campo--error' : ''}`;
  const error = (campo) =>
    errores[campo] && (
      <span className="campo__error" role="alert">
        {errores[campo]}
      </span>
    );
  const yo = veterinarios.find((v) => v.es_yo);

  return (
    <section>
      <BotonVolver a="/citas" texto="Volver a citas" />
      <h1 className="saludo__titulo">
        {esPropietario ? 'Solicitar una cita' : 'Agendar una cita'}
      </h1>
      <p className="texto-sec">
        Elige la mascota, el veterinario, el día y una hora disponible.
      </p>
      <Alerta tipo="error">{errorGeneral}</Alerta>

      {esPropietario && mascotas.length === 0 ? (
        <div className="vacio">
          <p className="texto-sec">
            Primero registra una mascota para poder solicitar una cita.
          </p>
          <Link to="/mascotas/nueva" className="boton boton--oscuro">
            Registrar mascota
          </Link>
        </div>
      ) : (
        <form
          className="formulario formulario--ancho tarjeta"
          onSubmit={guardar}
          noValidate
        >
          <div className="campos-grid">
            <div className={clase('id_mascota')}>
              <label htmlFor="cita-mascota">Mascota *</label>
              <select
                id="cita-mascota"
                value={valores.id_mascota}
                onChange={(e) => cambiar('id_mascota', e.target.value)}
              >
                <option value="">Elige la mascota…</option>
                {mascotas.map((m) => (
                  <option key={m.id_mascota} value={m.id_mascota}>
                    {m.nombre} ({m.especie})
                    {!esPropietario && m.nombre_propietario
                      ? ` · ${m.nombre_propietario}`
                      : ''}
                  </option>
                ))}
              </select>
              {error('id_mascota')}
            </div>

            {esVeterinario && yo ? (
              <div className="campo">
                <span className="campo__etiqueta">Veterinario</span>
                <p>
                  {yo.nombre} {yo.apellido} (tu agenda)
                </p>
              </div>
            ) : (
              <div className={clase('id_veterinario')}>
                <label htmlFor="cita-veterinario">Veterinario *</label>
                <select
                  id="cita-veterinario"
                  value={valores.id_veterinario}
                  onChange={(e) => cambiar('id_veterinario', e.target.value)}
                >
                  <option value="">Elige el veterinario…</option>
                  {veterinarios.map((v) => (
                    <option key={v.id_veterinario} value={v.id_veterinario}>
                      {v.nombre} {v.apellido}
                      {v.especialidad ? ` · ${v.especialidad}` : ''}
                    </option>
                  ))}
                </select>
                {error('id_veterinario')}
              </div>
            )}
          </div>

          <fieldset className={`${clase('tipo_consulta')} grupo-horas`}>
            <legend className="campo__etiqueta">Tipo de consulta *</legend>
            <div className="tipos-consulta">
              {TIPOS_CONSULTA.map(({ valor, etiqueta, duracion }) => {
                const Icono = ICONOS_TIPO[valor];
                return (
                  <button
                    key={valor}
                    type="button"
                    className="tipo-consulta"
                    aria-pressed={valores.tipo_consulta === valor}
                    onClick={() => {
                      // Al elegir el tipo se fija su duración (el personal puede cambiarla)
                      setValores((v) => ({
                        ...v,
                        tipo_consulta: valor,
                        duracion_min: duracion,
                        hora: Number(v.duracion_min) === duracion ? v.hora : '',
                      }));
                      setErrores((e) => ({ ...e, tipo_consulta: undefined }));
                    }}
                  >
                    <Icono size={18} aria-hidden="true" />
                    {etiqueta}
                  </button>
                );
              })}
            </div>
            {error('tipo_consulta')}
          </fieldset>

          <div className="campos-grid">
            <div className={clase('fecha')}>
              <label htmlFor="cita-fecha">Día *</label>
              <input
                id="cita-fecha"
                type="date"
                min={hoy}
                value={valores.fecha}
                onChange={(e) => cambiar('fecha', e.target.value)}
              />
              {error('fecha')}
            </div>
            {esPropietario ? (
              // El propietario no elige cuánto dura: depende del tipo de consulta
              <div className="campo">
                <span className="campo__etiqueta">Duración estimada</span>
                <p className="cita-duracion-fija">
                  {valores.tipo_consulta
                    ? `${valores.duracion_min} minutos`
                    : 'Elige el tipo de consulta'}
                </p>
              </div>
            ) : (
              <div className="campo">
                <label htmlFor="cita-duracion">Duración</label>
                <select
                  id="cita-duracion"
                  value={valores.duracion_min}
                  onChange={(e) => cambiar('duracion_min', e.target.value)}
                >
                  {DURACIONES.map((d) => (
                    <option key={d} value={d}>
                      {d} minutos
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <fieldset className={`${clase('hora')} grupo-horas`}>
            <legend className="campo__etiqueta">Hora *</legend>
            {!valores.id_veterinario ? (
              <p className="texto-sec">
                Elige primero el veterinario para ver sus horas libres.
              </p>
            ) : valores.fecha < hoy ? (
              <p className="texto-sec">Elige un día de hoy en adelante.</p>
            ) : cargandoHoras ? (
              <CargandoInline texto="Buscando horas disponibles…" />
            ) : (
              <>
                <div className="horas-grid">
                  {horas.map(({ hora, estado }) => (
                    <button
                      key={hora}
                      type="button"
                      className={`hora-opcion hora-opcion--${estado}`}
                      disabled={estado !== 'libre'}
                      aria-pressed={valores.hora === hora}
                      title={
                        estado === 'ocupada'
                          ? 'Horario ocupado'
                          : estado === 'pasada'
                            ? 'Esta hora ya pasó'
                            : undefined
                      }
                      onClick={() => {
                        setValores((v) => ({ ...v, hora }));
                        setErrores((e) => ({ ...e, hora: undefined }));
                      }}
                    >
                      {horaLegible(hora)}
                    </button>
                  ))}
                </div>
                <p className="leyenda-horas">
                  <span className="libre">Disponible</span>
                  <span className="ocupada">Ocupada</span>
                  <span className="pasada">Ya pasó</span>
                </p>
                {horas.every((h) => h.estado !== 'libre') && (
                  <p className="texto-sec">
                    No quedan horas libres este día. Prueba con otro día.
                  </p>
                )}
              </>
            )}
            {error('hora')}
          </fieldset>

          <div className={clase('motivo')}>
            <label htmlFor="cita-motivo">Motivo *</label>
            <textarea
              id="cita-motivo"
              rows={3}
              maxLength={200}
              placeholder="Ej.: vacuna anual, revisión de piel, control…"
              value={valores.motivo}
              onChange={(e) => cambiar('motivo', e.target.value)}
            />
            <span className="texto-sec contador">
              {valores.motivo.length}/200
            </span>
            {error('motivo')}
          </div>

          <div className="formulario__acciones">
            <Link to="/citas" className="boton boton--claro">
              Cancelar
            </Link>
            <button
              type="submit"
              className="boton boton--oscuro"
              disabled={guardando}
            >
              {guardando
                ? 'Guardando…'
                : esPropietario
                  ? 'Solicitar cita'
                  : 'Agendar cita'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

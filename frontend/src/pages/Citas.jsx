import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Check,
  CheckCheck,
  Clock,
  Plus,
  UserX,
} from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { sumarDias } from '../utils/format.js';
import {
  diaClinica,
  diaLargo,
  esActiva,
  ESTADOS_CITA,
  FILTROS_ESTADO,
  horaClinica,
  etiquetaTipoConsulta,
} from '../utils/citas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import ModalConfirmar from '../components/ModalConfirmar.jsx';

const POR_PAGINA = 30;

/** Agrupa las citas por día (en la hora de la clínica) conservando el orden. */
function agruparPorDia(citas) {
  const grupos = [];
  for (const cita of citas) {
    const dia = diaClinica(cita.fecha_hora);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.citas.push(cita);
    else grupos.push({ dia, fecha: cita.fecha_hora, citas: [cita] });
  }
  return grupos;
}

export function EstadoCita({ estado }) {
  const info = ESTADOS_CITA[estado] ?? { etiqueta: estado, clase: '' };
  return (
    <span className={`estado estado-cita estado-cita--${info.clase}`}>
      {info.etiqueta}
    </span>
  );
}

/**
 * Ep3-Hu14: interfaz de citas veterinarias.
 * - Propietario: solicita citas y ve las suyas con su estado (puede cancelarlas).
 * - Veterinario: ve su agenda y confirma, completa, cancela o marca «no asistió».
 * - Administrador: ve todas las citas y puede gestionarlas.
 */
export default function Citas() {
  const rol = rolActual();
  const esPropietario = rol === 'propietario';
  const esPersonal = rol === 'veterinario' || rol === 'administrador';
  const location = useLocation();

  const [vista, setVista] = useState('proximas');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [citas, setCitas] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState(location.state?.mensaje ?? '');
  const [recargar, setRecargar] = useState(0);
  const [procesando, setProcesando] = useState(null);
  const [porCancelar, setPorCancelar] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const hoy = diaClinica(new Date());
    const filtros = new URLSearchParams({
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });
    if (vista === 'proximas') {
      filtros.set('desde', hoy);
      filtros.set('orden', 'asc');
    } else {
      filtros.set('hasta', sumarDias(hoy, -1));
      filtros.set('orden', 'desc');
    }
    if (estado) filtros.set('estado', estado);

    api
      .get(`/citas?${filtros}`)
      .then((r) => {
        if (cancelado) return;
        setCitas((anteriores) =>
          pagina === 1 ? r.datos : [...anteriores, ...r.datos]
        );
        setTotal(r.meta.total);
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(err.message || 'No se pudieron cargar las citas.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vista, estado, pagina, recargar]);

  function filtrar(cambio) {
    setCargando(true);
    setPagina(1);
    cambio();
  }

  const TEXTOS_EXITO = {
    confirmada: 'La cita quedó confirmada.',
    atendida: 'La cita se marcó como completada.',
    no_asistio: 'Se registró que el paciente no asistió.',
    cancelada: 'La cita fue cancelada y el horario quedó libre.',
  };

  async function cambiarEstado(cita, nuevoEstado) {
    setProcesando(cita.id_cita);
    setMensaje('');
    setError('');
    try {
      const actualizada = await api.put(`/citas/${cita.id_cita}/estado`, {
        estado: nuevoEstado,
      });
      // Se actualiza en la lista sin recargar; si hay filtro de estado, se recarga
      if (estado) filtrar(() => setRecargar((n) => n + 1));
      else
        setCitas((lista) =>
          lista.map((c) =>
            c.id_cita === cita.id_cita ? { ...c, ...actualizada } : c
          )
        );
      setMensaje(TEXTOS_EXITO[nuevoEstado]);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la cita.');
    } finally {
      setProcesando(null);
      setPorCancelar(null);
    }
  }

  const grupos = agruparPorDia(citas);

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">
            {rol === 'veterinario' ? 'Mi agenda' : 'Citas'}
          </h1>
          <p className="texto-sec">
            {esPropietario
              ? 'Solicita citas para tus mascotas y revisa en qué estado están.'
              : rol === 'veterinario'
                ? 'Tus citas: confírmalas, márcalas como completadas o cancélalas.'
                : 'Todas las citas de la clínica.'}
          </p>
        </div>
        <Link to="/citas/nueva" className="boton boton--oscuro">
          <Plus size={16} strokeWidth={2.2} />
          {esPropietario ? 'Solicitar cita' : 'Agendar cita'}
        </Link>
      </div>

      <div className="filtros-citas">
        <div className="segmentado" role="group" aria-label="Período">
          {[
            ['proximas', 'Próximas'],
            ['anteriores', 'Anteriores'],
          ].map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={vista === valor}
              className={vista === valor ? 'activo' : ''}
              onClick={() => filtrar(() => setVista(valor))}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <div className="chips-estado" role="group" aria-label="Estado">
          {FILTROS_ESTADO.map(([valor, etiqueta]) => (
            <button
              key={valor || 'todas'}
              type="button"
              aria-pressed={estado === valor}
              className={`chip-estado${estado === valor ? ' activo' : ''}${valor ? ` chip-estado--${ESTADOS_CITA[valor].clase}` : ''}`}
              onClick={() => filtrar(() => setEstado(valor))}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <Alerta tipo="exito">{mensaje}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando && pagina === 1 ? (
        <CargandoInline texto="Cargando citas…" />
      ) : citas.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <CalendarClock size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">
            {vista === 'proximas'
              ? 'No hay citas próximas con este filtro.'
              : 'No hay citas anteriores con este filtro.'}
          </p>
        </div>
      ) : (
        <>
          {grupos.map((grupo) => (
            <div key={grupo.dia} className="agenda-dia">
              <h2 className="agenda-dia__titulo">{diaLargo(grupo.fecha)}</h2>
              <ul className="lista-filas">
                {grupo.citas.map((c) => {
                  const activa = esActiva(c.estado);
                  const ocupada = procesando === c.id_cita;
                  return (
                    <li
                      key={c.id_cita}
                      className={`tarjeta fila-cita fila-cita--${ESTADOS_CITA[c.estado]?.clase}`}
                    >
                      <div className="fila-cita__hora">
                        <strong>{horaClinica(c.fecha_hora)}</strong>
                        <span className="texto-sec">
                          <Clock size={12} aria-hidden="true" />{' '}
                          {c.duracion_min} min
                        </span>
                      </div>
                      <div className="fila-cita__info">
                        <span className="fila-cita__tipo">
                          {etiquetaTipoConsulta(c.tipo_consulta)}
                        </span>
                        <span className="fila-entidad__titulo">
                          {c.nombre_mascota} · {c.motivo}
                        </span>
                        <span className="texto-sec">
                          {!esPropietario && `Dueño/a: ${c.nombre_propietario}`}
                          {!esPropietario && rol === 'administrador' && ' · '}
                          {rol !== 'veterinario' &&
                            `Veterinario/a: ${c.nombre_veterinario}`}
                        </span>
                        {c.observaciones && (
                          <span className="texto-sec">
                            <em>{c.observaciones}</em>
                          </span>
                        )}
                      </div>
                      <EstadoCita estado={c.estado} />
                      {activa && (
                        <div className="fila-cita__acciones">
                          {esPersonal && c.estado !== 'confirmada' && (
                            <button
                              type="button"
                              className="boton boton--claro boton--peq"
                              disabled={ocupada}
                              onClick={() => cambiarEstado(c, 'confirmada')}
                            >
                              <Check size={14} /> Confirmar
                            </button>
                          )}
                          {esPersonal && (
                            <button
                              type="button"
                              className="boton boton--claro boton--peq"
                              disabled={ocupada}
                              onClick={() => cambiarEstado(c, 'atendida')}
                            >
                              <CheckCheck size={14} /> Completada
                            </button>
                          )}
                          {esPersonal && (
                            <button
                              type="button"
                              className="boton boton--claro boton--peq"
                              disabled={ocupada}
                              onClick={() => cambiarEstado(c, 'no_asistio')}
                            >
                              <UserX size={14} /> No asistió
                            </button>
                          )}
                          <button
                            type="button"
                            className="boton boton--claro boton--cancelar boton--peq"
                            disabled={ocupada}
                            onClick={() => setPorCancelar(c)}
                          >
                            <CalendarX size={14} /> Cancelar
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {citas.length < total && (
            <button
              type="button"
              className="boton boton--claro cargar-mas"
              disabled={cargando}
              onClick={() => {
                setCargando(true);
                setPagina((p) => p + 1);
              }}
            >
              {cargando ? 'Cargando…' : `Ver más (${total - citas.length})`}
            </button>
          )}
        </>
      )}

      {porCancelar && (
        <ModalConfirmar
          titulo="¿Cancelar esta cita?"
          mensaje={`${porCancelar.nombre_mascota}, ${diaLargo(porCancelar.fecha_hora)}, ${horaClinica(porCancelar.fecha_hora)} — el horario quedará libre para otra persona.`}
          textoConfirmar="Sí, cancelar cita"
          confirmando={procesando === porCancelar.id_cita}
          onConfirmar={() => cambiarEstado(porCancelar, 'cancelada')}
          onCancelar={() => setPorCancelar(null)}
        />
      )}

      <p className="texto-sec leyenda-citas">
        <CalendarCheck size={14} aria-hidden="true" /> Horario de la clínica
        (hora de Colombia).
      </p>
    </section>
  );
}
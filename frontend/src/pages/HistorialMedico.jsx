import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  History,
  PawPrint,
  Pill,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { aFecha, fechaCorta, fechaHoraCorta } from '../utils/format.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FotoMascota from '../components/FotoMascota.jsx';

const POR_PAGINA = 20;

const TIPOS = [
  { clave: '', etiqueta: 'Todo' },
  {
    clave: 'consulta',
    etiqueta: 'Consultas',
    singular: 'Consulta',
    icono: Stethoscope,
  },
  {
    clave: 'tratamiento',
    etiqueta: 'Tratamientos',
    singular: 'Tratamiento',
    icono: Pill,
  },
  { clave: 'vacuna', etiqueta: 'Vacunas', singular: 'Vacuna', icono: Syringe },
];
const POR_CLAVE = Object.fromEntries(TIPOS.map((t) => [t.clave, t]));

const ESTADO_TRATAMIENTO = {
  activo: { clase: 'activo', texto: 'Activo' },
  finalizado: { clase: 'finalizado', texto: 'Finalizado' },
  suspendido: { clase: 'suspendido', texto: 'Suspendido' },
};

const lista = (r) => (Array.isArray(r) ? r : (r?.datos ?? []));
const anioDe = (fecha) => aFecha(fecha)?.getFullYear();

/** Un registro del historial: la forma cambia un poco según sea consulta, tratamiento o vacuna. */
function Registro({ evento, idMascota }) {
  const { tipo, titulo, detalle, estado, extra = {} } = evento;
  const { icono: Icono, singular } = POR_CLAVE[tipo];
  const estadoTrat = tipo === 'tratamiento' ? ESTADO_TRATAMIENTO[estado] : null;

  const datos = [];
  let enlace;
  if (tipo === 'consulta') {
    if (extra.veterinario) datos.push(`Atendió: ${extra.veterinario}`);
    if (extra.total_tratamientos > 0)
      datos.push(
        `${extra.total_tratamientos} ${extra.total_tratamientos === 1 ? 'tratamiento' : 'tratamientos'}`
      );
    if (extra.proximo_control)
      datos.push(`Próximo control: ${fechaCorta(extra.proximo_control)}`);
    enlace = { to: `/consultas/${evento.id}`, texto: 'Ver la consulta' };
  } else if (tipo === 'tratamiento') {
    if (extra.fecha_fin) datos.push(`Hasta el ${fechaCorta(extra.fecha_fin)}`);
    if (extra.indicaciones) datos.push(extra.indicaciones);
    enlace = {
      to: `/consultas/${evento.id_consulta}`,
      texto: 'Ver la consulta',
    };
  } else {
    const casa = [extra.laboratorio, extra.lote && `Lote ${extra.lote}`]
      .filter(Boolean)
      .join(' · ');
    if (casa) datos.push(casa);
    if (extra.proxima_dosis)
      datos.push(`Próxima dosis: ${fechaCorta(extra.proxima_dosis)}`);
    if (extra.veterinario) datos.push(`Aplicó: ${extra.veterinario}`);
    enlace = { to: `/mascotas/${idMascota}/carne`, texto: 'Ver el carné' };
  }

  return (
    <li className={`linea__item linea__item--${tipo}`}>
      <span className="linea__icono" aria-hidden="true">
        <Icono size={18} strokeWidth={1.9} />
      </span>
      <article className="tarjeta linea__tarjeta">
        <header className="linea__cabecera">
          <span className="linea__fecha">
            {tipo === 'consulta'
              ? fechaHoraCorta(evento.momento)
              : fechaCorta(evento.fecha)}
          </span>
          <span className="linea__tipo">{singular}</span>
          {estadoTrat && (
            <span className={`estado estado--${estadoTrat.clase}`}>
              {estadoTrat.texto}
            </span>
          )}
        </header>
        <h2 className="linea__titulo">{titulo}</h2>
        {detalle && (
          <p className="linea__detalle">
            {tipo === 'consulta' && <strong>Diagnóstico: </strong>}
            {detalle}
          </p>
        )}
        {datos.length > 0 && (
          <p className="texto-sec linea__datos">{datos.join(' · ')}</p>
        )}
        <Link to={enlace.to} className="linea__enlace">
          {enlace.texto}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}

/**
 * Ep4-Hu2: historial médico cronológico de una mascota. El propietario elige una de
 * sus mascotas y ve sus consultas, tratamientos y vacunas en una línea de tiempo
 * (solo lectura), que puede filtrar por tipo de registro y por rango de fechas.
 */
export default function HistorialMedico() {
  const esPropietario = rolActual() === 'propietario';
  const [parametros, setParametros] = useSearchParams();

  const [mascotas, setMascotas] = useState(null);
  const [errorMascotas, setErrorMascotas] = useState('');

  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState('desc');
  const [pagina, setPagina] = useState(1);

  const [eventos, setEventos] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Mascotas que puede consultar (el propietario, solo las suyas: lo controla la API)
  useEffect(() => {
    let cancelado = false;
    api
      .get('/mascotas?limite=100')
      .then((r) => {
        if (!cancelado) setMascotas(lista(r));
      })
      .catch((err) => {
        if (!cancelado) {
          setMascotas([]);
          setErrorMascotas(
            err.message || 'No se pudieron cargar tus mascotas.'
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Mascota elegida: la de la dirección (?mascota=) o, si no hay, la primera de la lista
  const pedida = Number(parametros.get('mascota'));
  const mascota =
    mascotas?.find((m) => m.id_mascota === pedida) ?? mascotas?.[0] ?? null;
  const idMascota = mascota?.id_mascota ?? null;

  const rangoInvalido = Boolean(desde && hasta && desde > hasta);

  useEffect(() => {
    if (!idMascota || rangoInvalido) return undefined;
    let cancelado = false;
    const filtros = new URLSearchParams({
      orden,
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });
    if (tipo) filtros.set('tipo', tipo);
    if (desde) filtros.set('desde', desde);
    if (hasta) filtros.set('hasta', hasta);
    api
      .get(`/mascotas/${idMascota}/historial?${filtros}`)
      .then((r) => {
        if (cancelado) return;
        // La página 1 reemplaza la lista; las siguientes se agregan al final
        setEventos((anteriores) =>
          pagina === 1 ? r.datos : [...anteriores, ...r.datos]
        );
        setMeta(r.meta);
        setResumen(r.resumen);
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(err.message || 'No se pudo cargar el historial médico.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [idMascota, tipo, desde, hasta, orden, pagina, rangoInvalido]);

  // Cualquier cambio de filtro vuelve a la primera página
  function filtrar(cambio) {
    setCargando(true);
    setPagina(1);
    cambio();
  }

  function elegirMascota(id) {
    filtrar(() => {
      setTipo('');
      setDesde('');
      setHasta('');
      setResumen(null);
      setParametros({ mascota: id }, { replace: true });
    });
  }

  function limpiarFiltros() {
    filtrar(() => {
      setTipo('');
      setDesde('');
      setHasta('');
    });
  }

  const hayFiltros = Boolean(tipo || desde || hasta);
  const totalGeneral = resumen
    ? resumen.consulta + resumen.tratamiento + resumen.vacuna
    : 0;

  // Línea de tiempo con un separador cada vez que cambia el año
  const filas = [];
  eventos.forEach((e, i) => {
    const anio = anioDe(e.fecha);
    if (i === 0 || anio !== anioDe(eventos[i - 1].fecha)) {
      filas.push(
        <li
          key={`anio-${anio}-${i}`}
          className="linea__anio"
          aria-hidden="true"
        >
          {anio}
        </li>
      );
    }
    filas.push(
      <Registro key={`${e.tipo}-${e.id}`} evento={e} idMascota={idMascota} />
    );
  });

  let contenido;
  if (rangoInvalido) {
    contenido = (
      <Alerta tipo="error">
        La fecha «Desde» no puede ser posterior a la fecha «Hasta».
      </Alerta>
    );
  } else if (error) {
    contenido = <Alerta tipo="error">{error}</Alerta>;
  } else if (cargando && pagina === 1) {
    contenido = <CargandoInline texto="Cargando historial…" />;
  } else if (eventos.length === 0) {
    contenido = (
      <div className="vacio">
        <span className="icono-circulo icono-circulo--44" aria-hidden="true">
          <History size={22} strokeWidth={1.8} />
        </span>
        {hayFiltros ? (
          <>
            <p className="texto-sec">
              No encontramos registros con los filtros elegidos.
            </p>
            <button
              type="button"
              className="boton boton--claro"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          </>
        ) : (
          <p className="texto-sec">
            {mascota.nombre} todavía no tiene consultas, tratamientos ni vacunas
            registrados.
          </p>
        )}
      </div>
    );
  } else {
    contenido = (
      <>
        <p className="texto-sec linea__conteo" aria-live="polite">
          Mostrando {eventos.length} de {meta.total}{' '}
          {meta.total === 1 ? 'registro' : 'registros'}
        </p>
        <ol
          className="linea"
          aria-label={`Historial médico de ${mascota.nombre}`}
        >
          {filas}
        </ol>
        {eventos.length < meta.total && (
          <button
            type="button"
            className="boton boton--claro cargar-mas"
            disabled={cargando}
            onClick={() => {
              setCargando(true);
              setPagina((p) => p + 1);
            }}
          >
            {cargando ? 'Cargando…' : 'Ver más registros'}
          </button>
        )}
      </>
    );
  }

  return (
    <section className="historial-medico">
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Historial médico</h1>
          <p className="texto-sec">
            {esPropietario
              ? 'Las consultas, tratamientos y vacunas de tus mascotas, en orden cronológico.'
              : 'Consultas, tratamientos y vacunas de la mascota, en orden cronológico.'}
          </p>
        </div>
      </div>

      <Alerta tipo="error">{errorMascotas}</Alerta>

      {mascotas === null ? (
        <CargandoInline texto="Cargando mascotas…" />
      ) : mascotas.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <PawPrint size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">
            {esPropietario
              ? 'Aún no tienes mascotas registradas, así que no hay historial para mostrar.'
              : 'No hay mascotas registradas.'}
          </p>
          {esPropietario && (
            <Link to="/mascotas/nueva" className="boton boton--oscuro">
              Registrar una mascota
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="historial-medico__mascota tarjeta">
            <FotoMascota mascota={mascota} tamano={56} />
            <div className="campo historial-medico__selector">
              <label htmlFor="historial-mascota">Mascota</label>
              <select
                id="historial-mascota"
                value={idMascota}
                onChange={(e) => elegirMascota(Number(e.target.value))}
              >
                {mascotas.map((m) => (
                  <option key={m.id_mascota} value={m.id_mascota}>
                    {m.nombre}
                    {!esPropietario && m.nombre_propietario
                      ? ` · ${m.nombre_propietario}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filtros-consultas historial-medico__filtros">
            <div
              className="historial-medico__tipos"
              role="group"
              aria-label="Tipo de registro"
            >
              {TIPOS.map((t) => {
                const cantidad = !resumen
                  ? null
                  : t.clave
                    ? resumen[t.clave]
                    : totalGeneral;
                return (
                  <button
                    key={t.clave || 'todo'}
                    type="button"
                    className="historial-medico__tipo"
                    aria-pressed={tipo === t.clave}
                    onClick={() => filtrar(() => setTipo(t.clave))}
                  >
                    {t.etiqueta}
                    {cantidad !== null && (
                      <span className="historial-medico__cantidad">
                        {cantidad}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <label className="filtro-fecha">
              Desde
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => filtrar(() => setDesde(e.target.value))}
              />
            </label>
            <label className="filtro-fecha">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => filtrar(() => setHasta(e.target.value))}
              />
            </label>
            <label className="filtro-fecha">
              Orden
              <select
                value={orden}
                onChange={(e) => filtrar(() => setOrden(e.target.value))}
              >
                <option value="desc">Más recientes primero</option>
                <option value="asc">Más antiguos primero</option>
              </select>
            </label>
            {hayFiltros && (
              <button
                type="button"
                className="boton boton--claro"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {contenido}
        </>
      )}
    </section>
  );
}
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { api } from '../../services/api.js';
import { aFecha } from '../../utils/format.js';
import { estadoEnCarne } from '../../utils/vacunas.js';

// Registros por pestaña (por defecto 4); el resto se ve en la página completa

const ESTADO_TRATAMIENTO = {
  activo: { clase: 'activo', texto: 'Activo' },
  finalizado: { clase: 'finalizado', texto: 'Finalizado' },
  suspendido: { clase: 'suspendido', texto: 'Suspendido' },
};

/** "2026-10-02" -> { dia: "02 oct", anio: "2026" } */
function partesFecha(valor) {
  const fecha = aFecha(valor);
  if (!fecha) return { dia: '—', anio: '' };
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = new Intl.DateTimeFormat('es-CO', { month: 'short' })
    .format(fecha)
    .replace('.', '')
    .slice(0, 3);
  return { dia: `${dia} ${mes}`, anio: String(fecha.getFullYear()) };
}

function Registro({ fecha, titulo, detalle, estado, to }) {
  const { dia, anio } = partesFecha(fecha);
  const contenido = (
    <>
      <span className="registro__fecha">
        <strong>{dia}</strong>
        <span>{anio}</span>
      </span>
      <span className="registro__texto">
        <strong>{titulo}</strong>
        {detalle && <span>{detalle}</span>}
      </span>
      {estado && (
        <span className={`estado estado--${estado.clase} registro__estado`}>
          {estado.texto}
        </span>
      )}
      {to && (
        <ChevronRight
          size={16}
          className="registro__flecha"
          aria-hidden="true"
        />
      )}
    </>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className="registro">
          {contenido}
        </Link>
      ) : (
        <div className="registro">{contenido}</div>
      )}
    </li>
  );
}

/**
 * Pestañas de cada mascota: Historia clínica (consultas), Vacunas y Tratamientos.
 * Los datos se piden solo cuando la tarjeta aparece en pantalla.
 */
export default function PanelMascota({ mascota, maximo: MAXIMO = 4 }) {
  const contenedor = useRef(null);
  const [visible, setVisible] = useState(false);
  const [historia, setHistoria] = useState(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState('historia');

  // Carga diferida: espera a que la tarjeta se vea
  useEffect(() => {
    const el = contenedor.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelado = false;
    api
      .get(`/mascotas/${mascota.id_mascota}/historia`)
      .then((datos) => {
        if (!cancelado) setHistoria(datos);
      })
      .catch((err) => {
        if (!cancelado)
          setError(
            err.estado === 404
              ? 'Esta mascota aún no tiene historia clínica.'
              : 'No se pudo cargar la información.'
          );
      });
    return () => {
      cancelado = true;
    };
  }, [visible, mascota.id_mascota]);

  const consultas = historia?.consultas ?? [];
  const vacunas = historia
    ? [...historia.vacunas].sort((a, b) =>
        String(b.fecha_aplicacion).localeCompare(String(a.fecha_aplicacion))
      )
    : [];
  const tratamientos = consultas
    .flatMap((c) =>
      (c.tratamientos ?? []).map((t) => ({ ...t, id_consulta: c.id_consulta }))
    )
    .sort((a, b) =>
      String(b.fecha_inicio).localeCompare(String(a.fecha_inicio))
    );

  const PESTANAS = [
    {
      clave: 'historia',
      etiqueta: 'Historia clínica',
      total: consultas.length,
    },
    { clave: 'vacunas', etiqueta: 'Vacunas', total: vacunas.length },
    {
      clave: 'tratamientos',
      etiqueta: 'Tratamientos',
      total: tratamientos.length,
    },
  ];

  const id = mascota.id_mascota;
  let lista;
  let vacio;
  let pie = null;

  if (pestana === 'historia') {
    vacio = 'Todavía no tiene consultas registradas.';
    lista = consultas
      .slice(0, MAXIMO)
      .map((c) => (
        <Registro
          key={c.id_consulta}
          fecha={c.fecha}
          titulo={c.motivo}
          detalle={
            c.diagnostico || c.observaciones || 'Sin diagnóstico registrado'
          }
          to={`/consultas/${c.id_consulta}`}
        />
      ));
    pie = (
      <Link to={`/mascotas/${id}/historia`} className="panel-mascota__ver">
        Ver historia clínica completa <ArrowRight size={14} />
      </Link>
    );
  } else if (pestana === 'vacunas') {
    vacio = 'Todavía no tiene vacunas registradas.';
    lista = vacunas
      .slice(0, MAXIMO)
      .map((v) => (
        <Registro
          key={v.id_vacuna}
          fecha={v.fecha_aplicacion}
          titulo={v.nombre}
          detalle={
            v.proxima_dosis
              ? `Próxima dosis: ${partesFecha(v.proxima_dosis).dia} ${partesFecha(v.proxima_dosis).anio}`
              : 'Sin refuerzo'
          }
          estado={estadoEnCarne(v, historia.vacunas)}
        />
      ));
    pie = (
      <Link to={`/mascotas/${id}/carne`} className="panel-mascota__ver">
        Ver carné de vacunación <ArrowRight size={14} />
      </Link>
    );
  } else {
    vacio = 'Todavía no tiene tratamientos registrados.';
    lista = tratamientos
      .slice(0, MAXIMO)
      .map((t) => (
        <Registro
          key={t.id_tratamiento}
          fecha={t.fecha_inicio}
          titulo={t.medicamento}
          detalle={[t.dosis, t.frecuencia, t.via].filter(Boolean).join(' · ')}
          estado={ESTADO_TRATAMIENTO[t.estado]}
          to={`/consultas/${t.id_consulta}`}
        />
      ));
  }

  const total = PESTANAS.find((p) => p.clave === pestana).total;

  return (
    <div className="panel-mascota" ref={contenedor}>
      <div className="panel-mascota__pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            role="tab"
            id={`tab-${id}-${p.clave}`}
            aria-selected={pestana === p.clave}
            aria-controls={`panel-${id}`}
            className="panel-mascota__pestana"
            onClick={() => setPestana(p.clave)}
          >
            {p.etiqueta}
            {historia && (
              <span className="panel-mascota__total">{p.total}</span>
            )}
          </button>
        ))}
      </div>

      <div
        className="panel-mascota__contenido"
        role="tabpanel"
        id={`panel-${id}`}
        aria-labelledby={`tab-${id}-${pestana}`}
      >
        {error ? (
          <p className="panel-mascota__vacio">{error}</p>
        ) : !historia ? (
          <ul className="panel-mascota__lista" aria-label="Cargando">
            {[0, 1, 2].map((n) => (
              <li key={n} className="registro registro--esqueleto">
                <span />
                <span />
              </li>
            ))}
          </ul>
        ) : lista.length === 0 ? (
          <p className="panel-mascota__vacio">{vacio}</p>
        ) : (
          <>
            <ul className="panel-mascota__lista">{lista}</ul>
            {total > MAXIMO && (
              <p className="panel-mascota__mas">
                y {total - MAXIMO}{' '}
                {total - MAXIMO === 1 ? 'registro' : 'registros'} más
              </p>
            )}
          </>
        )}
        {historia && pie}
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Pill,
  Syringe,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  destinoPendiente,
  detallePendiente,
  ESTADO_PENDIENTE,
  ETIQUETA_TIPO_PENDIENTE,
  partesFecha,
} from '../../utils/pendientes.js';

const ICONO = { cita: CalendarClock, vacuna: Syringe, tratamiento: Pill };

function Pendiente({ pendiente, idMascota }) {
  const { dia, anio } = partesFecha(pendiente.fecha);
  const Icono = ICONO[pendiente.tipo];
  const estado = ESTADO_PENDIENTE[pendiente.estado];
  const vencido = pendiente.estado === 'vencido';
  return (
    <li>
      <Link
        to={destinoPendiente(pendiente, idMascota)}
        className={`registro pendiente${vencido ? ' pendiente--vencido' : ''}`}
      >
        <span className="registro__fecha">
          <strong>{dia}</strong>
          <span>{anio}</span>
        </span>
        <span className="registro__texto">
          <strong>
            <Icono size={14} aria-hidden="true" />
            <span className="sr-only">
              {ETIQUETA_TIPO_PENDIENTE[pendiente.tipo]}:{' '}
            </span>
            {pendiente.titulo}
          </strong>
          <span>{detallePendiente(pendiente)}</span>
        </span>
        <span className={`estado estado--${estado.clase} registro__estado`}>
          {estado.texto}
        </span>
        <ChevronRight
          size={16}
          className="registro__flecha"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/**
 * Sección «Pendientes» del detalle de la mascota (Ep5-Hu4): próximas citas, vacunas por aplicar
 * o vencidas y tratamientos activos en un solo lugar, ordenados por fecha. Los vencidos se resaltan.
 */
export default function PendientesMascota({ idMascota }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/mascotas/${idMascota}/pendientes`)
      .then((respuesta) => {
        if (!cancelado) setDatos(respuesta);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los pendientes.');
      });
    return () => {
      cancelado = true;
    };
  }, [idMascota]);

  const pendientes = datos?.datos ?? [];

  return (
    <section
      className="tarjeta pendientes"
      aria-labelledby={`pendientes-titulo-${idMascota}`}
    >
      <header className="pendientes__cabecera">
        <h2 id={`pendientes-titulo-${idMascota}`}>Pendientes</h2>
        {datos && datos.vencidos > 0 && (
          <span className="estado estado--vencida">
            <TriangleAlert size={12} aria-hidden="true" />{' '}
            {datos.vencidos === 1 ? '1 vencido' : `${datos.vencidos} vencidos`}
          </span>
        )}
      </header>

      {error ? (
        <p className="pendientes__vacio" role="alert">
          {error}
        </p>
      ) : !datos ? (
        <ul className="pendientes__lista" aria-label="Cargando">
          {[0, 1, 2].map((n) => (
            <li key={n} className="registro registro--esqueleto">
              <span />
              <span />
            </li>
          ))}
        </ul>
      ) : pendientes.length === 0 ? (
        <p className="pendientes__vacio">
          <CheckCircle2 size={18} aria-hidden="true" />
          {datos.mascota.nombre} no tiene pendientes por ahora.
        </p>
      ) : (
        <ul className="pendientes__lista">
          {pendientes.map((p) => (
            <Pendiente
              key={`${p.tipo}-${p.id}`}
              pendiente={p}
              idMascota={idMascota}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Syringe,
} from 'lucide-react';
import { api } from '../services/api.js';
import { EVENTO_NOTIFICACIONES } from '../components/Topbar.jsx';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';

const POR_PAGINA = 20;
const ICONOS = {
  cita: CalendarClock,
  vacuna: Syringe,
  tratamiento: BellRing,
  aviso: Bell,
};

const fechaCorta = (iso) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

/**
 * Ep5-Hu1: bandeja de notificaciones (recordatorios de citas, vacunas y tratamientos, y avisos).
 * Se pueden marcar como leídas una a una o todas juntas.
 */
export default function Notificaciones() {
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    let activo = true;
    api
      .get(
        `/notificaciones?pagina=${pagina}&limite=${POR_PAGINA}${soloNoLeidas ? '&solo_no_leidas=true' : ''}`
      )
      .then((r) => {
        if (!activo) return;
        setLista(r.datos);
        setTotal(r.meta.total);
        setError('');
      })
      .catch((err) => {
        if (activo)
          setError(err.message || 'No se pudieron cargar las notificaciones.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [pagina, soloNoLeidas, recargar]);

  const avisarCampana = () =>
    window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));

  async function marcarLeida(n) {
    if (n.leido) return;
    try {
      await api.patch(`/notificaciones/${n.id_notificacion}/leida`);
      setLista((l) =>
        l.map((x) =>
          x.id_notificacion === n.id_notificacion ? { ...x, leido: true } : x
        )
      );
      avisarCampana();
    } catch (err) {
      setError(err.message || 'No se pudo marcar como leída.');
    }
  }

  async function marcarTodas() {
    try {
      await api.post('/notificaciones/marcar-leidas', {});
      setPagina(1);
      setRecargar((n) => n + 1);
      avisarCampana();
    } catch (err) {
      setError(err.message || 'No se pudieron marcar como leídas.');
    }
  }

  const hayNoLeidas = lista.some((n) => !n.leido);
  const paginas = Math.max(Math.ceil(total / POR_PAGINA), 1);

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Notificaciones</h1>
          <p className="texto-sec">
            Recordatorios de citas, vacunas y tratamientos, y avisos de la
            clínica.
          </p>
        </div>
        <button
          type="button"
          className="boton boton--claro"
          onClick={marcarTodas}
          disabled={!hayNoLeidas}
        >
          <CheckCheck size={16} strokeWidth={2.2} />
          Marcar todas como leídas
        </button>
      </div>

      <div
        className="segmentado notificaciones__filtro"
        role="group"
        aria-label="Filtro"
      >
        {[
          [false, 'Todas'],
          [true, 'Sin leer'],
        ].map(([valor, etiqueta]) => (
          <button
            key={etiqueta}
            type="button"
            aria-pressed={soloNoLeidas === valor}
            className={soloNoLeidas === valor ? 'activo' : ''}
            onClick={() => {
              setCargando(true);
              setPagina(1);
              setSoloNoLeidas(valor);
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <Alerta>{error}</Alerta>
      {cargando ? (
        <CargandoInline texto="Cargando notificaciones…" />
      ) : lista.length === 0 ? (
        <div className="vacio">
          <p className="texto-sec">
            {soloNoLeidas
              ? 'No tienes notificaciones sin leer.'
              : 'Aún no tienes notificaciones.'}
          </p>
        </div>
      ) : (
        <ul className="notificaciones">
          {lista.map((n) => {
            const Icono = ICONOS[n.tipo] ?? Bell;
            return (
              <li
                key={n.id_notificacion}
                className={`notificacion${n.leido ? '' : ' notificacion--nueva'}`}
              >
                <span className="notificacion__icono" aria-hidden="true">
                  <Icono size={18} strokeWidth={1.8} />
                </span>
                <div className="notificacion__texto">
                  <p className="notificacion__titulo">{n.titulo}</p>
                  <p className="notificacion__mensaje">{n.mensaje}</p>
                  <p className="notificacion__fecha">{fechaCorta(n.fecha)}</p>
                </div>
                <div className="notificacion__acciones">
                  {n.enlace && (
                    <Link
                      to={n.enlace}
                      className="boton boton--claro boton--peq"
                      onClick={() => marcarLeida(n)}
                    >
                      Ver
                    </Link>
                  )}
                  {!n.leido && (
                    <button
                      type="button"
                      className="boton boton--claro boton--peq"
                      onClick={() => marcarLeida(n)}
                    >
                      Marcar como leída
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {paginas > 1 && (
        <div className="paginacion">
          <button
            type="button"
            className="boton boton--claro boton--peq"
            disabled={pagina <= 1}
            onClick={() => setPagina(pagina - 1)}
          >
            Anterior
          </button>
          <span className="texto-sec">
            Página {pagina} de {paginas}
          </span>
          <button
            type="button"
            className="boton boton--claro boton--peq"
            disabled={pagina >= paginas}
            onClick={() => setPagina(pagina + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}

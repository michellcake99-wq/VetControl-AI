import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Stethoscope, X } from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { fechaHoraCorta } from '../utils/format.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FotoMascota from '../components/FotoMascota.jsx';

const POR_PAGINA = 20;

/**
 * Ep3-Hu13: módulo de consultas. Lista todas las consultas con fecha y hora
 * (la más reciente primero). El propietario solo ve las de sus mascotas.
 * El veterinario registra consultas nuevas desde aquí.
 */
export default function Consultas() {
  const rol = rolActual();
  const esVeterinario = rol === 'veterinario';
  const esPropietario = rol === 'propietario';
  const location = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const idMascota = parametros.get('mascota');

  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [consultas, setConsultas] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje] = useState(location.state?.mensaje ?? '');

  useEffect(() => {
    let cancelado = false;
    const filtros = new URLSearchParams({
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });
    if (busqueda.trim()) filtros.set('q', busqueda.trim());
    if (idMascota) filtros.set('id_mascota', idMascota);
    if (desde) filtros.set('desde', desde);
    if (hasta) filtros.set('hasta', hasta);
    api
      .get(`/consultas?${filtros}`)
      .then((r) => {
        if (cancelado) return;
        // La página 1 reemplaza la lista; las siguientes se agregan al final
        setConsultas((anteriores) =>
          pagina === 1 ? r.datos : [...anteriores, ...r.datos]
        );
        setTotal(r.meta.total);
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(err.message || 'No se pudieron cargar las consultas.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [busqueda, idMascota, desde, hasta, pagina]);

  // Cualquier cambio de filtro vuelve a la página 1
  function filtrar(cambio) {
    setCargando(true);
    setPagina(1);
    cambio();
  }

  const nombreMascotaFiltro = idMascota && consultas[0]?.nombre_mascota;

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Consultas</h1>
          <p className="texto-sec">
            {esPropietario
              ? 'Las consultas de tus mascotas, de la más reciente a la más antigua.'
              : 'Todas las consultas registradas, de la más reciente a la más antigua.'}
          </p>
        </div>
        {esVeterinario && (
          <Link
            to={`/consultas/nueva${idMascota ? `?mascota=${idMascota}` : ''}`}
            className="boton boton--oscuro"
          >
            <Plus size={16} strokeWidth={2.2} />
            Nueva consulta
          </Link>
        )}
      </div>

      <div className="filtros-consultas">
        <input
          type="search"
          className="campo-busqueda"
          placeholder="Buscar por mascota, motivo o diagnóstico…"
          value={busqueda}
          onChange={(e) => filtrar(() => setBusqueda(e.target.value))}
          aria-label="Buscar consulta"
        />
        <label className="filtro-fecha">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => filtrar(() => setDesde(e.target.value))}
          />
        </label>
        <label className="filtro-fecha">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => filtrar(() => setHasta(e.target.value))}
          />
        </label>
      </div>

      {idMascota && (
        <p className="chip-filtro">
          Mostrando solo las consultas de{' '}
          <strong>{nombreMascotaFiltro || 'la mascota elegida'}</strong>
          <button
            type="button"
            onClick={() => filtrar(() => setParametros({}))}
            aria-label="Ver las consultas de todas las mascotas"
          >
            <X size={14} />
            Ver todas
          </button>
        </p>
      )}

      <Alerta tipo="exito">{mensaje}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando && pagina === 1 ? (
        <CargandoInline texto="Cargando consultas…" />
      ) : consultas.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <Stethoscope size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">
            No hay consultas que coincidan con la búsqueda.
          </p>
        </div>
      ) : (
        <>
          <ul className="lista-filas">
            {consultas.map((c) => (
              <li key={c.id_consulta}>
                <Link
                  to={`/consultas/${c.id_consulta}`}
                  className="tarjeta fila-entidad fila-consulta"
                >
                  <FotoMascota
                    mascota={{ foto: c.foto, nombre: c.nombre_mascota }}
                    tamano={48}
                  />
                  <div className="fila-consulta__info">
                    <span className="consulta__fecha">
                      {fechaHoraCorta(c.fecha)}
                    </span>
                    <span className="fila-entidad__titulo">
                      {c.nombre_mascota} · {c.motivo}
                    </span>
                    <span className="texto-sec">
                      <strong>Diagnóstico:</strong> {c.diagnostico}
                    </span>
                    <span className="texto-sec">
                      {c.numero_historia} · Atendió:{' '}
                      {c.nombre_veterinario || '—'}
                      {!esPropietario && ` · Dueño/a: ${c.nombre_propietario}`}
                    </span>
                  </div>
                  <ChevronRight
                    className="chevron"
                    size={22}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {consultas.length < total && (
            <button
              type="button"
              className="boton boton--claro cargar-mas"
              disabled={cargando}
              onClick={() => {
                setCargando(true);
                setPagina((p) => p + 1);
              }}
            >
              {cargando ? 'Cargando…' : `Ver más (${total - consultas.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

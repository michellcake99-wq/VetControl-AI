import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Users, ChevronDown, PawPrint } from 'lucide-react';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';

export default function Propietarios() {
  const location = useLocation();
  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Mensaje que llega desde el formulario después de registrar un propietario
  const [mensajeExito] = useState(location.state?.mensaje ?? '');
  const [busqueda, setBusqueda] = useState('');

  // Ep3-Hu11: mascotas de cada propietario, cargadas al desplegar su fila
  const [expandido, setExpandido] = useState(null);
  const [mascotasPorPropietario, setMascotasPorPropietario] = useState({});
  const [cargandoMascotas, setCargandoMascotas] = useState(false);

  useEffect(() => {
    // Evita que una respuesta vieja (de una búsqueda anterior) pise a la más reciente
    let cancelado = false;
    const parametros = busqueda ? `?q=${encodeURIComponent(busqueda)}` : '';
    api
      .get(`/propietarios${parametros}`)
      .then((r) => {
        if (cancelado) return;
        setPropietarios(Array.isArray(r) ? r : (r?.datos ?? []));
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(
            err.message || 'No se pudo cargar el listado de propietarios'
          );
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [busqueda]);

  function cambiarBusqueda(valor) {
    setCargando(true);
    setBusqueda(valor);
  }

  async function alternarMascotas(idPropietario) {
    if (expandido === idPropietario) {
      setExpandido(null);
      return;
    }
    setExpandido(idPropietario);
    if (mascotasPorPropietario[idPropietario]) return; // ya se cargaron antes

    setCargandoMascotas(true);
    try {
      const r = await api.get(`/propietarios/${idPropietario}/mascotas`);
      setMascotasPorPropietario((m) => ({
        ...m,
        [idPropietario]: Array.isArray(r) ? r : (r?.datos ?? []),
      }));
    } catch {
      setMascotasPorPropietario((m) => ({ ...m, [idPropietario]: [] }));
    } finally {
      setCargandoMascotas(false);
    }
  }

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Propietarios</h1>
          <p className="texto-sec">Dueños registrados y sus mascotas.</p>
        </div>
        <Link to="/propietarios/nuevo" className="boton boton--oscuro">
          <Plus size={16} strokeWidth={2.2} />
          Registrar propietario
        </Link>
      </div>

      <input
        type="search"
        className="campo-busqueda"
        placeholder="Buscar por nombre, correo o documento…"
        value={busqueda}
        onChange={(e) => cambiarBusqueda(e.target.value)}
        aria-label="Buscar propietario"
      />

      <Alerta tipo="exito">{mensajeExito}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <CargandoInline texto="Cargando propietarios…" />
      ) : propietarios.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <Users size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">Todavía no hay propietarios registrados.</p>
        </div>
      ) : (
        <div className="lista-filas">
          {propietarios.map((p) => (
            <div key={p.id_propietario} className="tarjeta fila-propietario">
              <div className="fila-entidad">
                <div>
                  <p className="fila-entidad__titulo">
                    {p.nombre} {p.apellido}
                  </p>
                  <p className="texto-sec">
                    {p.correo} · {p.numero_documento}
                  </p>
                </div>
                <button
                  type="button"
                  className={`etiqueta${expandido === p.id_propietario ? ' etiqueta--activa' : ''}`}
                  onClick={() => alternarMascotas(p.id_propietario)}
                  aria-expanded={expandido === p.id_propietario}
                >
                  {p.total_mascotas ?? 0}{' '}
                  {Number(p.total_mascotas) === 1 ? 'mascota' : 'mascotas'}
                  <ChevronDown size={14} />
                </button>
              </div>

              {expandido === p.id_propietario && (
                <div className="fila-propietario__mascotas">
                  {cargandoMascotas &&
                  !mascotasPorPropietario[p.id_propietario] ? (
                    <p className="texto-sec">Cargando mascotas…</p>
                  ) : mascotasPorPropietario[p.id_propietario]?.length ? (
                    mascotasPorPropietario[p.id_propietario].map((m) => (
                      <span key={m.id_mascota} className="chip-mascota">
                        <PawPrint size={13} strokeWidth={1.8} />
                        {m.nombre}{' '}
                        <span className="texto-sec">· {m.especie}</span>
                      </span>
                    ))
                  ) : (
                    <p className="texto-sec">Sin mascotas registradas.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

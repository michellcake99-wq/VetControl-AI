import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ClipboardList,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  Plus,
  Search,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FotoMascota from '../components/FotoMascota.jsx';

const POR_PAGINA = 24;
// Colores del avatar con las iniciales (cada propietario siempre tiene el mismo)
const COLORES_AVATAR = ['teal', 'azul', 'ambar', 'rosa', 'verde', 'lila'];

const iniciales = (p) =>
  `${p.nombre?.[0] ?? ''}${p.apellido?.[0] ?? ''}`.toUpperCase();

const desde = (fecha) =>
  fecha
    ? new Intl.DateTimeFormat('es-CO', {
        month: 'short',
        year: 'numeric',
      }).format(new Date(fecha))
    : '';

/**
 * Ep3-Hu11: listado de propietarios para el personal de la clínica.
 * Tarjetas con datos de contacto y, al desplegarlas, las mascotas de cada dueño.
 */
export default function Propietarios() {
  const location = useLocation();
  const [propietarios, setPropietarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // Mensaje que llega desde el formulario después de registrar un propietario
  const [mensajeExito] = useState(location.state?.mensaje ?? '');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Mascotas de cada propietario, cargadas al desplegar su tarjeta
  const [expandido, setExpandido] = useState(null);
  const [mascotasPorPropietario, setMascotasPorPropietario] = useState({});

  // Espera a que la persona deje de escribir antes de buscar
  useEffect(() => {
    const espera = setTimeout(() => {
      if (texto.trim() !== busqueda) {
        setCargando(true);
        setPagina(1);
        setBusqueda(texto.trim());
      }
    }, 300);
    return () => clearTimeout(espera);
  }, [texto, busqueda]);

  useEffect(() => {
    // Evita que una respuesta vieja (de una búsqueda anterior) pise a la más reciente
    let cancelado = false;
    const parametros = new URLSearchParams({
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });
    if (busqueda) parametros.set('q', busqueda);
    api
      .get(`/propietarios?${parametros}`)
      .then((r) => {
        if (cancelado) return;
        const datos = Array.isArray(r) ? r : (r?.datos ?? []);
        setPropietarios((anteriores) =>
          pagina === 1 ? datos : [...anteriores, ...datos]
        );
        setTotal(r?.meta?.total ?? datos.length);
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
  }, [busqueda, pagina]);

  async function alternarMascotas(idPropietario) {
    if (expandido === idPropietario) {
      setExpandido(null);
      return;
    }
    setExpandido(idPropietario);
    if (mascotasPorPropietario[idPropietario]) return; // ya se cargaron antes

    try {
      const r = await api.get(`/propietarios/${idPropietario}/mascotas`);
      setMascotasPorPropietario((m) => ({
        ...m,
        [idPropietario]: Array.isArray(r) ? r : (r?.datos ?? []),
      }));
    } catch {
      setMascotasPorPropietario((m) => ({ ...m, [idPropietario]: [] }));
    }
  }

  const totalMascotas = propietarios.reduce(
    (suma, p) => suma + Number(p.total_mascotas ?? 0),
    0
  );
  const sinMascotas = propietarios.filter(
    (p) => !Number(p.total_mascotas)
  ).length;
  const completos = propietarios.length >= total;

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Propietarios</h1>
          <p className="texto-sec">
            Dueños registrados, sus datos de contacto y sus mascotas.
          </p>
        </div>
        <Link to="/propietarios/nuevo" className="boton boton--oscuro">
          <Plus size={16} strokeWidth={2.2} />
          Registrar propietario
        </Link>
      </div>

      {!busqueda && !cargando && total > 0 && (
        <div className="resumen-propietarios">
          <div className="resumen-propietarios__dato">
            <span
              className="icono-circulo icono-circulo--44"
              aria-hidden="true"
            >
              <Users size={18} />
            </span>
            <div>
              <strong>{total}</strong>
              <span>{total === 1 ? 'Propietario' : 'Propietarios'}</span>
            </div>
          </div>
          {completos && (
            <>
              <div className="resumen-propietarios__dato">
                <span
                  className="icono-circulo icono-circulo--44"
                  aria-hidden="true"
                >
                  <PawPrint size={18} />
                </span>
                <div>
                  <strong>{totalMascotas}</strong>
                  <span>Mascotas registradas</span>
                </div>
              </div>
              <div className="resumen-propietarios__dato">
                <span
                  className="icono-circulo icono-circulo--44"
                  aria-hidden="true"
                >
                  <UserRoundX size={18} />
                </span>
                <div>
                  <strong>{sinMascotas}</strong>
                  <span>Sin mascotas aún</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="buscador">
        <Search size={17} className="buscador__icono" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por nombre, correo o documento…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar propietario"
        />
        {texto && (
          <button
            type="button"
            className="buscador__limpiar"
            onClick={() => setTexto('')}
            aria-label="Limpiar búsqueda"
          >
            <X size={15} />
          </button>
        )}
      </div>
      {busqueda && !cargando && (
        <p className="texto-sec resultado-busqueda">
          {total} {total === 1 ? 'resultado' : 'resultados'} para «{busqueda}»
        </p>
      )}

      <Alerta tipo="exito">{mensajeExito}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando && pagina === 1 ? (
        <CargandoInline texto="Cargando propietarios…" />
      ) : propietarios.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <Users size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">
            {busqueda
              ? `No encontramos propietarios con «${busqueda}».`
              : 'Todavía no hay propietarios registrados.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid-propietarios">
            {propietarios.map((p) => {
              const abierto = expandido === p.id_propietario;
              const mascotas = mascotasPorPropietario[p.id_propietario];
              const cantidad = Number(p.total_mascotas ?? 0);
              return (
                <article
                  key={p.id_propietario}
                  className={`tarjeta tarjeta-propietario${abierto ? ' tarjeta-propietario--abierta' : ''}`}
                >
                  <header className="tarjeta-propietario__cabecera">
                    <span
                      className={`avatar-iniciales avatar-iniciales--${COLORES_AVATAR[p.id_propietario % COLORES_AVATAR.length]}`}
                      aria-hidden="true"
                    >
                      {iniciales(p)}
                    </span>
                    <div className="tarjeta-propietario__nombre">
                      <h2>
                        {p.nombre} {p.apellido}
                      </h2>
                      <span className="texto-sec">
                        {p.tipo_documento} {p.numero_documento}
                      </span>
                    </div>
                    {p.fecha_registro && (
                      <span
                        className="tarjeta-propietario__desde"
                        title="Fecha de registro"
                      >
                        Desde {desde(p.fecha_registro)}
                      </span>
                    )}
                  </header>

                  <ul className="tarjeta-propietario__contacto">
                    <li>
                      <Mail size={15} aria-hidden="true" />
                      <a href={`mailto:${p.correo}`}>{p.correo}</a>
                    </li>
                    <li>
                      <Phone size={15} aria-hidden="true" />
                      {p.telefono ? (
                        <a href={`tel:${p.telefono}`}>{p.telefono}</a>
                      ) : (
                        <span className="texto-sec">Sin teléfono</span>
                      )}
                    </li>
                    <li>
                      <MapPin size={15} aria-hidden="true" />
                      {p.direccion ? (
                        <span>{p.direccion}</span>
                      ) : (
                        <span className="texto-sec">Sin dirección</span>
                      )}
                    </li>
                  </ul>

                  <button
                    type="button"
                    className="tarjeta-propietario__toggle"
                    onClick={() => alternarMascotas(p.id_propietario)}
                    aria-expanded={abierto}
                    disabled={cantidad === 0}
                  >
                    <PawPrint size={15} aria-hidden="true" />
                    {cantidad === 0
                      ? 'Sin mascotas registradas'
                      : `${abierto ? 'Ocultar' : 'Ver'} ${cantidad} ${cantidad === 1 ? 'mascota' : 'mascotas'}`}
                    {cantidad > 0 && (
                      <ChevronDown
                        size={15}
                        className="tarjeta-propietario__flecha"
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {abierto && (
                    <div className="tarjeta-propietario__mascotas">
                      {!mascotas ? (
                        <p className="texto-sec">Cargando mascotas…</p>
                      ) : mascotas.length === 0 ? (
                        <p className="texto-sec">Sin mascotas registradas.</p>
                      ) : (
                        mascotas.map((m) => (
                          <div key={m.id_mascota} className="mini-mascota">
                            <FotoMascota mascota={m} tamano={38} />
                            <div className="mini-mascota__datos">
                              <strong>{m.nombre}</strong>
                              <span className="texto-sec">
                                {m.especie}
                                {m.raza ? ` · ${m.raza}` : ''}
                              </span>
                            </div>
                            {m.id_historia && (
                              <Link
                                to={`/mascotas/${m.id_mascota}/historia`}
                                className="mini-mascota__enlace"
                                title={`Historia clínica de ${m.nombre}`}
                              >
                                <ClipboardList size={14} aria-hidden="true" />
                                Historia
                              </Link>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!completos && (
            <button
              type="button"
              className="boton boton--claro cargar-mas"
              disabled={cargando}
              onClick={() => {
                setCargando(true);
                setPagina((n) => n + 1);
              }}
            >
              {cargando
                ? 'Cargando…'
                : `Ver más (${total - propietarios.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
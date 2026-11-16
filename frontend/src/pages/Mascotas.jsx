import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Ban,
  ChevronRight,
  PawPrint,
  Pencil,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { calcularEdad, ETIQUETA_SEXO } from '../utils/mascotas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import ModalConfirmar from '../components/ModalConfirmar.jsx';
import FotoMascota from '../components/FotoMascota.jsx';

export default function Mascotas() {
  const rol = rolActual();
  const esPersonalClinica = rol === 'veterinario' || rol === 'administrador';
  const location = useLocation();

  const [mascotas, setMascotas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState(
    location.state?.mensaje ?? ''
  );
  const [busqueda, setBusqueda] = useState('');
  const [mascotaADesactivar, setMascotaADesactivar] = useState(null);
  const [desactivando, setDesactivando] = useState(false);
  // Al cambiar este número se vuelve a pedir el listado (por ejemplo, después de desactivar)
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    // Evita que una respuesta vieja (de una búsqueda anterior) pise a la más reciente
    let cancelado = false;
    const parametros = busqueda ? `?q=${encodeURIComponent(busqueda)}` : '';
    api
      .get(`/mascotas${parametros}`)
      .then((respuesta) => {
        if (cancelado) return;
        // El backend puede responder un arreglo plano o { datos, meta } según la versión
        setMascotas(
          Array.isArray(respuesta) ? respuesta : (respuesta?.datos ?? [])
        );
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(err.message || 'No se pudo cargar el listado de mascotas');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [busqueda, recargas]);

  function recargar() {
    setCargando(true);
    setRecargas((n) => n + 1);
  }

  function cambiarBusqueda(valor) {
    setCargando(true);
    setBusqueda(valor);
  }

  async function confirmarDesactivar() {
    if (!mascotaADesactivar) return;
    setDesactivando(true);
    try {
      await api.delete(`/mascotas/${mascotaADesactivar.id_mascota}`);
      setMensajeExito(
        `${mascotaADesactivar.nombre} fue desactivada correctamente.`
      );
      setMascotaADesactivar(null);
      recargar();
    } catch (err) {
      setError(err.message || 'No se pudo desactivar la mascota');
    } finally {
      setDesactivando(false);
    }
  }

  const titulo = esPersonalClinica ? 'Pacientes' : 'Mis mascotas';

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">{titulo}</h1>
          <p className="texto-sec">
            {esPersonalClinica
              ? 'Mascotas atendidas en la clínica. Toca una para ver su historia, vacunas y tratamientos.'
              : 'Tus compañeros peludos. Toca uno para ver su historia, vacunas y tratamientos.'}
          </p>
        </div>
        <Link to="/mascotas/nueva" className="boton boton--oscuro">
          <Plus size={16} strokeWidth={2.2} />
          Registrar mascota
        </Link>
      </div>

      <div className="buscador">
        <Search size={17} className="buscador__icono" aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por nombre o microchip…"
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          aria-label="Buscar mascota"
        />
        {busqueda && (
          <button
            type="button"
            className="buscador__limpiar"
            onClick={() => cambiarBusqueda('')}
            aria-label="Limpiar búsqueda"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <Alerta tipo="exito">{mensajeExito}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <CargandoInline texto="Cargando mascotas…" />
      ) : mascotas.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <PawPrint size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">
            {busqueda
              ? `No encontramos mascotas con «${busqueda}».`
              : 'Todavía no hay mascotas registradas.'}
          </p>
        </div>
      ) : (
        <div className="rejilla-pacientes">
          {mascotas.map((mascota) => (
            <article
              key={mascota.id_mascota}
              className="tarjeta tarjeta-paciente"
            >
              <FotoMascota mascota={mascota} tamano={76} />
              <h2 className="tarjeta-paciente__nombre">
                {/* Toda la tarjeta abre la ficha de la mascota */}
                <Link
                  to={`/mascotas/${mascota.id_mascota}`}
                  className="tarjeta-paciente__enlace"
                >
                  {mascota.nombre}
                </Link>
              </h2>
              <p className="tarjeta-paciente__detalle">
                {mascota.especie} · {mascota.raza || 'Raza no registrada'}
              </p>
              <div className="ficha-mascota__chips">
                {mascota.fecha_nacimiento && (
                  <span>{calcularEdad(mascota.fecha_nacimiento)}</span>
                )}
                {ETIQUETA_SEXO[mascota.sexo] &&
                  mascota.sexo !== 'desconocido' && (
                    <span>{ETIQUETA_SEXO[mascota.sexo]}</span>
                  )}
              </div>
              {esPersonalClinica && mascota.nombre_propietario && (
                <p className="ficha-mascota__dueno">
                  <User size={13} aria-hidden="true" />
                  {mascota.nombre_propietario}
                </p>
              )}

              <div className="tarjeta-paciente__acciones">
                <Link
                  to={`/mascotas/${mascota.id_mascota}/editar`}
                  className="boton boton--claro boton--peq"
                >
                  <Pencil size={14} />
                  Editar
                </Link>
                {esPersonalClinica && (
                  <button
                    type="button"
                    className="boton boton--peligro boton--peq"
                    onClick={() => setMascotaADesactivar(mascota)}
                  >
                    <Ban size={14} />
                    Desactivar
                  </button>
                )}
              </div>
              <span className="tarjeta-paciente__ver" aria-hidden="true">
                Ver ficha <ChevronRight size={14} />
              </span>
            </article>
          ))}
        </div>
      )}

      {mascotaADesactivar && (
        <ModalConfirmar
          titulo="Desactivar mascota"
          mensaje={`¿Seguro que quieres desactivar a ${mascotaADesactivar.nombre}? Su historial clínico se conserva.`}
          confirmando={desactivando}
          onConfirmar={confirmarDesactivar}
          onCancelar={() => setMascotaADesactivar(null)}
        />
      )}
    </section>
  );
}
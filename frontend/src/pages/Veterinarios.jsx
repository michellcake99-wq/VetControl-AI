import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Stethoscope, Pencil, Ban } from 'lucide-react';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import ModalConfirmar from '../components/ModalConfirmar.jsx';

export default function Veterinarios() {
  const location = useLocation();
  const [veterinarios, setVeterinarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState(
    location.state?.mensaje ?? ''
  );
  const [busqueda, setBusqueda] = useState('');
  const [aDesactivar, setADesactivar] = useState(null);
  const [desactivando, setDesactivando] = useState(false);
  // Al cambiar este número se vuelve a pedir el listado (por ejemplo, después de desactivar)
  const [recargas, setRecargas] = useState(0);

  useEffect(() => {
    // Evita que una respuesta vieja (de una búsqueda anterior) pise a la más reciente
    let cancelado = false;
    const parametros = busqueda ? `?q=${encodeURIComponent(busqueda)}` : '';
    api
      .get(`/veterinarios${parametros}`)
      .then((r) => {
        if (cancelado) return;
        setVeterinarios(Array.isArray(r) ? r : (r?.datos ?? []));
        setError('');
      })
      .catch((err) => {
        if (!cancelado)
          setError(
            err.message || 'No se pudo cargar el listado de veterinarios'
          );
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
    if (!aDesactivar) return;
    setDesactivando(true);
    try {
      await api.delete(`/veterinarios/${aDesactivar.id_veterinario}`);
      setMensajeExito(
        `${aDesactivar.nombre} ${aDesactivar.apellido} fue desactivado/a correctamente.`
      );
      setADesactivar(null);
      recargar();
    } catch (err) {
      setError(err.message || 'No se pudo desactivar al veterinario');
    } finally {
      setDesactivando(false);
    }
  }

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Veterinarios</h1>
          <p className="texto-sec">Personal médico habilitado en la clínica.</p>
        </div>
        <Link to="/veterinarios/nuevo" className="boton boton--oscuro">
          <Plus size={16} strokeWidth={2.2} />
          Registrar veterinario
        </Link>
      </div>

      <input
        type="search"
        className="campo-busqueda"
        placeholder="Buscar por nombre, tarjeta profesional o especialidad…"
        value={busqueda}
        onChange={(e) => cambiarBusqueda(e.target.value)}
        aria-label="Buscar veterinario"
      />

      <Alerta tipo="exito">{mensajeExito}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <CargandoInline texto="Cargando veterinarios…" />
      ) : veterinarios.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <Stethoscope size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">Todavía no hay veterinarios registrados.</p>
        </div>
      ) : (
        <div className="lista-filas">
          {veterinarios.map((v) => (
            <div key={v.id_veterinario} className="tarjeta fila-entidad">
              <div>
                <p className="fila-entidad__titulo">
                  {v.nombre} {v.apellido}
                </p>
                <p className="texto-sec">
                  {v.especialidad} · Tarjeta {v.tarjeta_profesional}
                </p>
              </div>
              <div className="fila-entidad__acciones">
                <Link
                  to={`/veterinarios/${v.id_veterinario}/editar`}
                  className="boton boton--claro boton--peq"
                >
                  <Pencil size={14} />
                  Editar
                </Link>
                <button
                  type="button"
                  className="boton boton--peligro boton--peq"
                  onClick={() => setADesactivar(v)}
                >
                  <Ban size={14} />
                  Desactivar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aDesactivar && (
        <ModalConfirmar
          titulo="Desactivar veterinario"
          mensaje={`¿Seguro que quieres desactivar a ${aDesactivar.nombre} ${aDesactivar.apellido}? Ya no podrá iniciar sesión, pero su historial se conserva.`}
          confirmando={desactivando}
          onConfirmar={confirmarDesactivar}
          onCancelar={() => setADesactivar(null)}
        />
      )}
    </section>
  );
}

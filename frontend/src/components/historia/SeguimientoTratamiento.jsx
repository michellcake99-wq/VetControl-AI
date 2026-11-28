import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { rolActual } from '../../utils/sesion.js';
import './SeguimientoTratamiento.css';

function mostrarFecha(fecha) {
  if (!fecha) return 'Fecha no disponible';
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor);
}

/**
 * Ep5-Hu5: registro y consulta de notas de evolución de un tratamiento.
 * El propietario puede crear notas únicamente mientras el tratamiento está activo.
 * El veterinario puede consultar el historial en orden cronológico.
 */
export default function SeguimientoTratamiento({ tratamiento }) {
  const [notas, setNotas] = useState([]);
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const esPropietario = rolActual() === 'propietario';
  const puedeRegistrar = esPropietario && tratamiento.estado === 'activo';

  // La carga inicial se hace dentro del efecto y solo cambia el estado cuando
  // responde el servidor (así se evita volver a dibujar el componente en cascada).
  useEffect(() => {
    let vigente = true;
    api
      .get(`/tratamientos/${tratamiento.id_tratamiento}/evoluciones`)
      .then((datos) => {
        if (vigente) setNotas(Array.isArray(datos) ? datos : []);
      })
      .catch((err) => {
        if (vigente)
          setError(err.message || 'No se pudieron cargar los seguimientos.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [tratamiento.id_tratamiento]);

  async function registrar(e) {
    e.preventDefault();
    const texto = descripcion.trim();
    if (!texto) {
      setError('Escribe una descripción para registrar el seguimiento.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const nuevaNota = await api.post(
        `/tratamientos/${tratamiento.id_tratamiento}/evoluciones`,
        { descripcion: texto }
      );
      setNotas((actuales) => [...actuales, nuevaNota]);
      setDescripcion('');
      setMensaje('El seguimiento se registró correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo registrar el seguimiento.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="seguimiento-tratamiento"
      aria-labelledby={`seguimiento-titulo-${tratamiento.id_tratamiento}`}
    >
      <div className="seguimiento-tratamiento__encabezado">
        <div>
          <h3 id={`seguimiento-titulo-${tratamiento.id_tratamiento}`}>
            Seguimiento del tratamiento
          </h3>
          <p>Notas sobre la evolución de la mascota durante el tratamiento.</p>
        </div>
        <span className="seguimiento-tratamiento__cantidad">
          {notas.length} {notas.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {error && (
        <p
          className="seguimiento-tratamiento__alerta seguimiento-tratamiento__alerta--error"
          role="alert"
        >
          {error}
        </p>
      )}
      {mensaje && (
        <p
          className="seguimiento-tratamiento__alerta seguimiento-tratamiento__alerta--exito"
          role="status"
        >
          {mensaje}
        </p>
      )}

      {puedeRegistrar && (
        <form
          className="seguimiento-tratamiento__formulario no-pdf"
          onSubmit={registrar}
        >
          <label
            htmlFor={`descripcion-seguimiento-${tratamiento.id_tratamiento}`}
          >
            ¿Cómo ha evolucionado tu mascota?
          </label>
          <textarea
            id={`descripcion-seguimiento-${tratamiento.id_tratamiento}`}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Describe los cambios que has observado, síntomas, mejorías o dificultades..."
            required
          />
          <div className="seguimiento-tratamiento__pie-formulario">
            <small>{descripcion.length}/2000 caracteres</small>
            <button
              type="submit"
              className="boton boton--oscuro"
              disabled={guardando || !descripcion.trim()}
            >
              {guardando ? 'Guardando…' : 'Registrar seguimiento'}
            </button>
          </div>
          <small className="seguimiento-tratamiento__ayuda">
            La fecha, hora y tu usuario se guardan automáticamente.
          </small>
        </form>
      )}

      {!puedeRegistrar && esPropietario && (
        <p className="seguimiento-tratamiento__solo-lectura">
          Este tratamiento no está activo. Puedes consultar los seguimientos
          registrados, pero no agregar nuevas notas.
        </p>
      )}

      <div className="seguimiento-tratamiento__lista" aria-live="polite">
        {cargando ? (
          <p className="seguimiento-tratamiento__vacio">
            Cargando seguimientos…
          </p>
        ) : notas.length === 0 ? (
          <p className="seguimiento-tratamiento__vacio">
            Todavía no hay notas de seguimiento para este tratamiento.
          </p>
        ) : (
          notas.map((nota) => (
            <article
              className="seguimiento-tratamiento__nota"
              key={nota.id_evolucion}
            >
              <div className="seguimiento-tratamiento__nota-meta">
                <strong>
                  {[nota.autor_nombre, nota.autor_apellido]
                    .filter(Boolean)
                    .join(' ') || 'Usuario registrado'}
                </strong>
                <time dateTime={nota.fecha}>{mostrarFecha(nota.fecha)}</time>
              </div>
              <p>{nota.descripcion}</p>
            </article>
          ))
        )}
      </div>
      <p className="seguimiento-tratamiento__inmutabilidad">
        Los registros de seguimiento son permanentes y no se pueden eliminar
        desde la aplicación.
      </p>
    </section>
  );
}

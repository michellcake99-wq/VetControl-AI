import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Scale, TrendingDown, TrendingUp, Minus, ListChecks } from 'lucide-react';
import { api } from '../services/api.js';
import { fechaCorta } from '../utils/format.js';
import { formatoPeso, variacion, ROL_REGISTRADOR } from '../utils/seguimiento.js';
import Alerta from '../components/Alerta.jsx';
import BotonVolver from '../components/BotonVolver.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import GraficaPeso from '../components/mascotas/GraficaPeso.jsx';
import FormularioSeguimiento from '../components/mascotas/FormularioSeguimiento.jsx';
import './Seguimiento.css';

// Ícono según el cambio de peso (sube, baja o sin cambios / sin dato)
function IconoVariacion({ clase }) {
  if (clase === 'sube') return <TrendingUp size={18} aria-hidden="true" />;
  if (clase === 'baja') return <TrendingDown size={18} aria-hidden="true" />;
  return <Minus size={18} aria-hidden="true" />;
}

/**
 * Ep4-Hu3: seguimiento de la evolución de la mascota. Se registra el peso (kg), la fecha
 * y las observaciones; el peso se ve en una gráfica de línea y los registros se listan
 * con quién los hizo. Lo ven todos los roles (el propietario, solo el de sus mascotas) y
 * lo registran el veterinario y el propietario.
 */
export default function SeguimientoMascota() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/mascotas/${id}/seguimiento`)
      .then((r) => {
        if (!cancelado) setDatos(r);
      })
      .catch((err) => {
        if (!cancelado)
          setError(
            err.estado === 404 || err.estado === 403
              ? 'No encontramos esta mascota o no tienes permiso para ver su seguimiento.'
              : err.message || 'No se pudo cargar el seguimiento.'
          );
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  function alGuardar(registro) {
    setExito(`Se registró ${formatoPeso(registro.peso_kg)} del ${fechaCorta(registro.fecha)}.`);
    // Se vuelve a pedir la lista para mostrarla en orden (la fecha puede ser anterior a otras)
    api
      .get(`/mascotas/${id}/seguimiento`)
      .then(setDatos)
      .catch(() =>
        setError('El registro se guardó, pero no se pudo actualizar la lista. Recarga la página.')
      );
  }

  if (!datos) {
    return (
      <section className="seguimiento">
        <BotonVolver a={`/mascotas/${id}`} texto="Volver" />
        {error ? <Alerta tipo="error">{error}</Alerta> : <CargandoInline texto="Cargando seguimiento…" />}
      </section>
    );
  }

  const { mascota, datos: registros } = datos;
  const ultimo = registros[0];
  const cambio = variacion(registros);

  return (
    <section className="seguimiento">
      <BotonVolver a={`/mascotas/${id}`} texto="Volver" />

      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Evolución de {mascota.nombre}</h1>
          <p className="texto-sec">
            Peso y observaciones a lo largo del tiempo, para detectar a tiempo cambios en su salud.
          </p>
        </div>
      </div>

      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{exito}</Alerta>

      <div className="seguimiento__resumen">
        <article className="tarjeta seguimiento__dato">
          <Scale size={18} aria-hidden="true" />
          <span className="texto-sec">Último peso</span>
          <strong>{ultimo ? formatoPeso(ultimo.peso_kg) : '—'}</strong>
          {ultimo && <span className="texto-sec">{fechaCorta(ultimo.fecha)}</span>}
        </article>
        <article className="tarjeta seguimiento__dato">
          <IconoVariacion clase={cambio?.clase} />
          <span className="texto-sec">Frente al registro anterior</span>
          <strong className={cambio ? `seguimiento__cambio--${cambio.clase}` : ''}>
            {cambio ? cambio.texto : '—'}
          </strong>
        </article>
        <article className="tarjeta seguimiento__dato">
          <ListChecks size={18} aria-hidden="true" />
          <span className="texto-sec">Registros</span>
          <strong>{registros.length}</strong>
        </article>
      </div>

      <article className="tarjeta seguimiento__bloque">
        <h2 className="consulta__subtitulo">Evolución del peso</h2>
        <GraficaPeso registros={registros} />
      </article>

      <article className="tarjeta seguimiento__bloque">
        <h2 className="consulta__subtitulo">Registrar peso y observaciones</h2>
        <FormularioSeguimiento idMascota={id} onGuardado={alGuardar} />
      </article>

      <article className="tarjeta seguimiento__bloque">
        <h2 className="consulta__subtitulo">Registros y observaciones</h2>
        {registros.length === 0 ? (
          <p className="texto-sec">Todavía no hay registros de seguimiento para {mascota.nombre}.</p>
        ) : (
          <ul className="seguimiento__lista">
            {registros.map((r) => (
              <li key={r.id_seguimiento} className="seguimiento__item">
                <div className="seguimiento__item-cabecera">
                  <strong>{formatoPeso(r.peso_kg)}</strong>
                  <span className="texto-sec">{fechaCorta(r.fecha)}</span>
                </div>
                {r.observaciones && <p className="seguimiento__obs">{r.observaciones}</p>}
                <p className="texto-sec seguimiento__autor">
                  Registró: {r.registrado_por} · {ROL_REGISTRADOR[r.rol_registrador] ?? r.rol_registrador}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

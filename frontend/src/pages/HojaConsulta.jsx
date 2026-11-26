import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Download, Pencil } from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { aISO, fechaCorta, fechaHoraCorta } from '../utils/format.js';
import { descargarPDF } from '../utils/pdf.js';
import { ESTADOS_TRATAMIENTO } from '../utils/consultas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import SeguimientoTratamiento from '../components/historia/SeguimientoTratamiento.jsx';
import {
  EncabezadoDocumento,
  DatosPropietarioPaciente,
} from '../components/historia/DocumentoClinico.jsx';
import {
  ExamenClinicoTabla,
  Hallazgos,
  MotivoConsulta,
  OrganosSistemas,
} from '../components/historia/ExamenClinico.jsx';

/**
 * Ep3-Hu13: hoja de una consulta con el formato de historia clínica
 * (motivo de consulta, examen clínico, órganos y sistemas, hallazgos,
 * diagnóstico y tratamientos). Todos los roles la pueden descargar en PDF.
 */
export default function HojaConsulta() {
  const { id } = useParams();
  const location = useLocation();
  const esVeterinario = rolActual() === 'veterinario';
  const documento = useRef(null);

  const [consulta, setConsulta] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState(location.state?.mensaje ?? '');
  const [aviso] = useState(location.state?.aviso ?? '');
  const [exportando, setExportando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/consultas/${id}`)
      .then((datos) => {
        if (!cancelado) setConsulta(datos);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err.estado === 404 || err.estado === 403
              ? 'No encontramos esta consulta o no tienes permiso para verla.'
              : err.message || 'No se pudo cargar la consulta.'
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  async function descargar() {
    flushSync(() => setExportando(true));
    try {
      const dia = aISO(new Date(consulta.fecha)); // fecha local, no UTC
      await descargarPDF(
        documento.current,
        `Consulta_${consulta.numero_historia}_${consulta.mascota.nombre}_${dia}.pdf`
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^A-Za-z0-9_.-]+/g, '_'),
        { titulo: 'Hoja de consulta' }
      );
    } catch {
      setError('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  // El veterinario cambia el estado de un tratamiento (activo, finalizado o suspendido)
  async function cambiarEstado(tratamiento, estado) {
    setCambiandoEstado(tratamiento.id_tratamiento);
    setMensaje('');
    try {
      const actualizado = await api.put(
        `/tratamientos/${tratamiento.id_tratamiento}`,
        { estado }
      );
      setConsulta((c) => ({
        ...c,
        tratamientos: c.tratamientos.map((t) =>
          t.id_tratamiento === actualizado.id_tratamiento ? actualizado : t
        ),
      }));
      setMensaje(
        `El tratamiento con ${tratamiento.medicamento} quedó ${estado}.`
      );
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el estado del tratamiento.');
    } finally {
      setCambiandoEstado(null);
    }
  }

  const volver = (
    <Link to="/consultas" className="historia__volver">
      <ArrowLeft size={16} aria-hidden="true" />
      Volver a consultas
    </Link>
  );

  if (!consulta) {
    return (
      <section>
        {volver}
        {error ? (
          <Alerta tipo="error">{error}</Alerta>
        ) : (
          <CargandoInline texto="Cargando consulta…" />
        )}
      </section>
    );
  }

  const { mascota, propietario } = consulta;

  return (
    <section className="historia">
      {volver}

      <header className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Consulta de {mascota.nombre}</h1>
          <p className="texto-sec">
            {fechaHoraCorta(consulta.fecha)} · {consulta.numero_historia}
          </p>
        </div>
        <div className="encabezado-pagina__acciones">
          <Link
            to={`/mascotas/${mascota.id_mascota}/historia`}
            className="boton boton--claro"
          >
            <ClipboardList size={16} />
            Historia clínica
          </Link>
          {consulta.puede_editar && (
            <Link
              to={`/consultas/${consulta.id_consulta}/editar`}
              className="boton boton--claro"
            >
              <Pencil size={16} />
              Editar
            </Link>
          )}
          <button
            type="button"
            className="boton boton--oscuro"
            onClick={descargar}
            disabled={exportando}
          >
            <Download size={16} />
            {exportando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      </header>
      <Alerta tipo="exito">{mensaje}</Alerta>
      <Alerta tipo="error">{aviso || error}</Alerta>

      <article
        ref={documento}
        className={`formato tarjeta${exportando ? ' formato--exportando' : ''}`}
        aria-label={`Consulta de ${mascota.nombre}`}
      >
        <EncabezadoDocumento
          subtitulo="Registro de consulta"
          numero={consulta.numero_historia}
          etiquetaFecha="Consulta"
          fecha={fechaHoraCorta(consulta.fecha)}
        />
        <DatosPropietarioPaciente propietario={propietario} mascota={mascota} />

        <MotivoConsulta consulta={consulta} />
        <ExamenClinicoTabla consulta={consulta} />
        <OrganosSistemas valores={consulta.organos_sistemas} />
        <Hallazgos consulta={consulta} />

        <section className="formato__seccion formato__evitar-corte">
          <h2 className="formato__barra">Diagnóstico y plan</h2>
          <table className="formato__tabla">
            <tbody>
              <tr>
                <th scope="row">Diagnóstico:</th>
                <td className="historia__texto">
                  <strong>{consulta.diagnostico}</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">Observaciones:</th>
                <td className="historia__texto">
                  {consulta.observaciones || 'Sin registrar'}
                </td>
              </tr>
              <tr>
                <th scope="row">Próximo control:</th>
                <td>
                  {consulta.proximo_control
                    ? fechaCorta(consulta.proximo_control)
                    : 'No programado'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="formato__seccion">
          <h2 className="formato__barra">Tratamientos indicados</h2>
          {consulta.tratamientos.length === 0 ? (
            <p className="formato__vacio">No se indicaron tratamientos.</p>
          ) : (
            <table className="formato__tabla formato__tabla--lista">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Dosis</th>
                  <th>Frecuencia</th>
                  <th>Vía</th>
                  <th>Periodo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {consulta.tratamientos.map((t) => (
                  <tr key={t.id_tratamiento}>
                    <td>
                      <strong>{t.medicamento}</strong>
                      {t.indicaciones && (
                        <span className="formato__nota">{t.indicaciones}</span>
                      )}
                    </td>
                    <td>{t.dosis}</td>
                    <td>{t.frecuencia}</td>
                    <td>{t.via || '—'}</td>
                    <td>
                      {fechaCorta(t.fecha_inicio)}
                      {t.fecha_fin ? ` – ${fechaCorta(t.fecha_fin)}` : ''}
                    </td>
                    <td>
                      <span className={`estado estado--${t.estado}`}>
                        {ESTADOS_TRATAMIENTO.find((e) => e.valor === t.estado)
                          ?.etiqueta ?? t.estado}
                      </span>
                      {esVeterinario && (
                        <select
                          className="formato__estado no-pdf"
                          value={t.estado}
                          disabled={cambiandoEstado === t.id_tratamiento}
                          onChange={(e) => cambiarEstado(t, e.target.value)}
                          aria-label={`Cambiar estado de ${t.medicamento}`}
                        >
                          {ESTADOS_TRATAMIENTO.map((e) => (
                            <option key={e.valor} value={e.valor}>
                              {e.etiqueta}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {consulta.tratamientos.map((tratamiento) => (
            <SeguimientoTratamiento
              key={tratamiento.id_tratamiento}
              tratamiento={tratamiento}
            />
          ))}
        </section>

        <div className="formato__firma formato__evitar-corte">
          <span className="formato__linea-firma" />
          <strong>{consulta.nombre_veterinario}</strong>
          <span>
            Médico veterinario
            {consulta.tarjeta_veterinario
              ? ` · T.P. ${consulta.tarjeta_veterinario}`
              : ''}
          </span>
        </div>
      </article>
    </section>
  );
}
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { fechaCorta, fechaHoraCorta } from '../utils/format.js';
import { descargarPDF, nombreArchivoHistoria } from '../utils/pdf.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import Antecedentes from '../components/historia/Antecedentes.jsx';
import {
  ExamenClinicoTabla,
  Hallazgos,
  MotivoConsulta,
  OrganosSistemas,
} from '../components/historia/ExamenClinico.jsx';
import ResumenIA from '../components/historia/ResumenIA.jsx';
import CarneVacunas from '../components/historia/CarneVacunas.jsx';
import {
  EncabezadoDocumento,
  DatosPropietarioPaciente,
} from '../components/historia/DocumentoClinico.jsx';

/**
 * Ep3-Hu12: historia clínica de una mascota con el formato de una historia
 * clínica veterinaria (encabezado, propietario, paciente, anamnésicos, motivo
 * de consulta, examen clínico, órganos y sistemas, hallazgos y vacunas).
 * Cualquier rol la puede descargar en PDF.
 * El propietario solo ve las de sus mascotas (lo controla la API).
 */
export default function HistoriaClinica() {
  const { id } = useParams();
  const esVeterinario = rolActual() === 'veterinario';
  const { hash } = useLocation();
  const documento = useRef(null);

  const [historia, setHistoria] = useState(null);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [errorPDF, setErrorPDF] = useState('');
  // Consulta cuyo examen clínico se muestra (null = la más reciente)
  const [idConsulta, setIdConsulta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/mascotas/${id}/historia`)
      .then((datos) => {
        if (!cancelado) setHistoria(datos);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err.estado === 404 || err.estado === 403
              ? 'No encontramos la historia clínica de esta mascota o no tienes permiso para verla.'
              : err.message || 'No se pudo cargar la historia clínica.'
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  // Ep4-Hu1: /mascotas/:id/historia#vacunas abre la página directamente en el carné
  const cargada = Boolean(historia);
  useEffect(() => {
    if (cargada && hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cargada, hash]);

  async function descargar() {
    setErrorPDF('');
    // Se abren todas las consultas y se quitan los botones antes de "fotografiar" la página
    flushSync(() => setExportando(true));
    try {
      await descargarPDF(
        documento.current,
        nombreArchivoHistoria(historia.numero, historia.mascota.nombre)
      );
    } catch {
      setErrorPDF('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  const volver = (
    <Link to="/mascotas" className="historia__volver">
      <ArrowLeft size={16} aria-hidden="true" />
      Volver a mascotas
    </Link>
  );

  if (error) {
    return (
      <section>
        {volver}
        <Alerta tipo="error">{error}</Alerta>
      </section>
    );
  }
  if (!historia) {
    return (
      <section>
        {volver}
        <CargandoInline texto="Cargando historia clínica…" />
      </section>
    );
  }

  const { mascota, propietario } = historia;
  // Las consultas vienen de la más reciente a la más antigua
  const consultaMostrada =
    historia.consultas.find((c) => c.id_consulta === idConsulta) ??
    historia.consultas[0] ??
    null;
  const tratamientosActivos = historia.consultas
    .flatMap((c) => c.tratamientos ?? [])
    .filter((t) => t.estado === 'activo');

  return (
    <section className="historia">
      {volver}

      <header className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Historia de {mascota.nombre}</h1>
          <p className="texto-sec">
            {historia.numero} · abierta el {fechaCorta(historia.fecha_apertura)}
          </p>
        </div>
        <button
          type="button"
          className="boton boton--oscuro"
          onClick={descargar}
          disabled={exportando}
        >
          <Download size={16} />
          {exportando ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
      </header>
      <Alerta tipo="error">{errorPDF}</Alerta>

      {/* Ep6-Hu2: resumen de la historia con IA */}
      <ResumenIA
        idMascota={mascota.id_mascota}
        nombreMascota={mascota.nombre}
      />

      <article
        ref={documento}
        className={`formato tarjeta${exportando ? ' formato--exportando' : ''}`}
        aria-label={`Historia clínica de ${mascota.nombre}`}
      >
        <EncabezadoDocumento
          subtitulo="Clínica veterinaria"
          numero={historia.numero}
          etiquetaFecha="Apertura"
          fecha={fechaCorta(historia.fecha_apertura)}
        />
        <DatosPropietarioPaciente propietario={propietario} mascota={mascota} />

        <Antecedentes
          historia={historia}
          tratamientosActivos={tratamientosActivos}
          puedeEditar={esVeterinario}
          onGuardado={(cambios) => setHistoria((h) => ({ ...h, ...cambios }))}
        />

        {/* Motivo de consulta y examen clínico (de la consulta elegida; por defecto, la más reciente) */}
        {historia.consultas.length > 1 && (
          <div className="historia__selector-consulta no-pdf">
            <label htmlFor="consulta-mostrada">
              Consulta que se muestra en el examen clínico:
            </label>
            <select
              id="consulta-mostrada"
              value={consultaMostrada?.id_consulta ?? ''}
              onChange={(e) => setIdConsulta(Number(e.target.value))}
            >
              {historia.consultas.map((c) => (
                <option key={c.id_consulta} value={c.id_consulta}>
                  {fechaHoraCorta(c.fecha)} · {c.motivo}
                </option>
              ))}
            </select>
          </div>
        )}
        <MotivoConsulta
          consulta={consultaMostrada}
          encabezado={
            <tr>
              <th scope="row">Fecha de la consulta:</th>
              <td>
                {consultaMostrada
                  ? `${fechaHoraCorta(consultaMostrada.fecha)}${consultaMostrada.nombre_veterinario ? ` · ${consultaMostrada.nombre_veterinario}` : ''}`
                  : 'Sin consultas registradas'}
              </td>
            </tr>
          }
        />
        <ExamenClinicoTabla consulta={consultaMostrada} />
        <OrganosSistemas valores={consultaMostrada?.organos_sistemas} />
        <Hallazgos consulta={consultaMostrada} />

        <CarneVacunas
          idHistoria={historia.id_historia}
          especie={mascota.especie}
          vacunasIniciales={historia.vacunas}
          puedeEditar={esVeterinario}
          onCambio={(vacunas) => setHistoria((h) => ({ ...h, vacunas }))}
        />

        <p className="formato__pie no-pdf">
          Documento generado por VetControl AI el{' '}
          {fechaCorta(new Date().toISOString())}. La información corresponde a
          los registros de la clínica a esa fecha.
        </p>
      </article>
    </section>
  );
}
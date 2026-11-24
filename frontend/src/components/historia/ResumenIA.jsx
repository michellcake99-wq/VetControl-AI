import { useState } from 'react';
import { Check, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import Alerta from '../Alerta.jsx';
import CargandoInline from '../CargandoInline.jsx';

/** Convierte el texto del resumen en secciones: «Título:» seguido de líneas «- elemento». */
function separarSecciones(texto) {
  const secciones = [];
  for (const linea of texto.split('\n').map((l) => l.trim())) {
    if (!linea) continue;
    if (linea.endsWith(':') && !linea.startsWith('-')) {
      secciones.push({ titulo: linea.slice(0, -1), lineas: [] });
    } else {
      if (!secciones.length) secciones.push({ titulo: '', lineas: [] });
      secciones.at(-1).lineas.push(linea.replace(/^-\s*/, ''));
    }
  }
  return secciones;
}

/**
 * Ep6-Hu2: botón «Resumir historial» + panel con el resumen generado por la IA
 * (antecedentes, diagnósticos recientes, tratamientos activos y vacunas de esta mascota).
 * Muestra el aviso de que lo generó una IA, un indicador de carga, el error con «Reintentar»
 * y un botón para copiar el texto.
 */
export default function ResumenIA({ idMascota, nombreMascota, onResumen }) {
  const [estado, setEstado] = useState('inicial'); // inicial | cargando | listo | error
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function resumir() {
    setEstado('cargando');
    setError('');
    setCopiado(false);
    try {
      const datos = await api.post('/ia/resumir-historial', {
        id_mascota: idMascota,
      });
      setResumen(datos);
      setEstado('listo');
      onResumen?.(datos); // Ep6-Hu5: la pantalla del asistente actualiza las consultas restantes
    } catch (err) {
      setError(err.message || 'No se pudo generar el resumen.');
      setEstado('error');
      onResumen?.(null);
    }
  }

  async function copiar() {
    const texto = `Resumen de la historia clínica de ${nombreMascota}\n\n${resumen.respuesta}\n\n${resumen.aviso}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  }

  return (
    <div className="resumen-ia no-pdf">
      <button
        type="button"
        className="boton boton--claro"
        onClick={resumir}
        disabled={estado === 'cargando'}
      >
        <Sparkles size={16} />
        {estado === 'cargando' ? 'Resumiendo…' : 'Resumir historial'}
      </button>

      {estado !== 'inicial' && (
        <section
          className="resumen-ia__panel tarjeta"
          aria-live="polite"
          aria-label={`Resumen de la historia de ${nombreMascota}`}
        >
          <h2 className="resumen-ia__titulo">
            <Sparkles size={16} aria-hidden="true" /> Resumen de {nombreMascota}
          </h2>

          {estado === 'cargando' && (
            <CargandoInline texto="Generando el resumen con IA…" />
          )}

          {estado === 'error' && (
            <>
              <Alerta tipo="error">{error}</Alerta>
              <button
                type="button"
                className="boton boton--claro boton--peq"
                onClick={resumir}
              >
                <RotateCcw size={14} /> Reintentar
              </button>
            </>
          )}

          {estado === 'listo' && (
            <>
              {separarSecciones(resumen.respuesta).map((s, i) => (
                <div key={i} className="resumen-ia__seccion">
                  {s.titulo && <h3>{s.titulo}</h3>}
                  <ul>
                    {s.lineas.map((l, j) => (
                      <li key={j}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="resumen-ia__aviso texto-sec">{resumen.aviso}</p>
              <Alerta tipo="error">{error}</Alerta>
              <div className="resumen-ia__acciones">
                <button
                  type="button"
                  className="boton boton--claro boton--peq"
                  onClick={copiar}
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  {copiado ? 'Copiado' : 'Copiar resumen'}
                </button>
                <button
                  type="button"
                  className="boton boton--claro boton--peq"
                  onClick={resumir}
                >
                  <RotateCcw size={14} /> Volver a generar
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
import { aFecha, fechaCorta } from '../../utils/format.js';
import { formatoPeso } from '../../utils/seguimiento.js';

const ANCHO = 640;
const ALTO = 260;
const M = { arriba: 16, derecha: 20, abajo: 34, izquierda: 52 };

/**
 * Ep4-Hu3: gráfica de línea del peso a lo largo del tiempo (SVG, sin librerías).
 * `registros`: lista de { id_seguimiento, fecha, peso_kg } en cualquier orden.
 */
export default function GraficaPeso({ registros }) {
  // De la fecha más antigua a la más reciente
  const puntos = [...registros].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) || a.id_seguimiento - b.id_seguimiento
  );

  if (puntos.length < 2) {
    return (
      <p className="texto-sec seguimiento__vacio">
        Registra al menos dos pesos para ver la gráfica de evolución.
      </p>
    );
  }

  const pesos = puntos.map((p) => p.peso_kg);
  const minimo = Math.min(...pesos);
  const maximo = Math.max(...pesos);
  const holgura = (maximo - minimo || maximo || 1) * 0.15;
  const yMin = Math.max(0, minimo - holgura);
  const yMax = maximo + holgura;

  const tiempos = puntos.map((p) => aFecha(p.fecha).getTime());
  const tMin = tiempos[0];
  const tMax = tiempos[tiempos.length - 1];
  const anchoUtil = ANCHO - M.izquierda - M.derecha;
  const altoUtil = ALTO - M.arriba - M.abajo;

  // Con fechas distintas el eje X es proporcional al tiempo; si todas son del mismo día, parejo
  const x = (i) =>
    M.izquierda +
    (tMax === tMin
      ? (anchoUtil * i) / (puntos.length - 1)
      : (anchoUtil * (tiempos[i] - tMin)) / (tMax - tMin));
  const y = (peso) =>
    M.arriba + altoUtil - (altoUtil * (peso - yMin)) / (yMax - yMin);

  const lineas = [0, 1, 2, 3].map((k) => yMin + ((yMax - yMin) * k) / 3);
  const trazo = puntos.map((p, i) => `${x(i)},${y(p.peso_kg)}`).join(' ');

  return (
    <svg
      className="grafica-peso"
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      role="img"
      aria-label={`Evolución del peso: de ${formatoPeso(pesos[0])} el ${fechaCorta(puntos[0].fecha)} a ${formatoPeso(pesos[pesos.length - 1])} el ${fechaCorta(puntos[puntos.length - 1].fecha)}`}
    >
      {lineas.map((valor) => (
        <g key={valor}>
          <line
            className="grafica-peso__guia"
            x1={M.izquierda}
            x2={ANCHO - M.derecha}
            y1={y(valor)}
            y2={y(valor)}
          />
          <text
            className="grafica-peso__eje"
            x={M.izquierda - 8}
            y={y(valor) + 4}
            textAnchor="end"
          >
            {valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
          </text>
        </g>
      ))}
      <text className="grafica-peso__eje" x={4} y={12}>
        kg
      </text>

      <polyline className="grafica-peso__linea" points={trazo} fill="none" />

      {puntos.map((p, i) => (
        <circle
          key={p.id_seguimiento}
          className="grafica-peso__punto"
          cx={x(i)}
          cy={y(p.peso_kg)}
          r={4.5}
        >
          <title>{`${fechaCorta(p.fecha)}: ${formatoPeso(p.peso_kg)}`}</title>
        </circle>
      ))}

      <text
        className="grafica-peso__eje"
        x={x(0)}
        y={ALTO - 10}
        textAnchor="start"
      >
        {fechaCorta(puntos[0].fecha)}
      </text>
      <text
        className="grafica-peso__eje"
        x={x(puntos.length - 1)}
        y={ALTO - 10}
        textAnchor="end"
      >
        {fechaCorta(puntos[puntos.length - 1].fecha)}
      </text>
    </svg>
  );
}

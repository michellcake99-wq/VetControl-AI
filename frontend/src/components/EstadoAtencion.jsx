import {
  estadoHorario,
  resumenHorario,
  textoProximaAtencion,
} from '../utils/atencion.js';

/**
 * Ep8-Hu4: estado de atención de un veterinario.
 * «En línea» depende de que tenga el chat abierto (llega por Socket.IO); el horario de
 * atención se calcula con la hora actual (hora de Colombia), por eso se recalcula con `ahora`.
 */
export default function EstadoAtencion({ estado, ahora, detallado = false }) {
  if (!estado) return null;
  const { en_horario: enHorario, proxima_atencion: proxima } = estadoHorario(
    estado.horario,
    ahora
  );
  const proximaTexto = textoProximaAtencion(proxima);

  let horarioTexto = 'Horario de atención no registrado';
  if (enHorario === true) horarioTexto = 'En horario de atención';
  if (enHorario === false)
    horarioTexto = `Fuera del horario de atención${proximaTexto ? ` · Vuelve a atender ${proximaTexto}` : ''}`;

  const punto = (
    <span
      className={`estado-atencion estado-atencion--${estado.en_linea ? 'en-linea' : 'fuera'}`}
    >
      <span className="estado-atencion__punto" aria-hidden="true" />
      {estado.en_linea ? 'En línea' : 'Fuera de línea'}
    </span>
  );

  if (!detallado) return punto;

  return (
    <div className="estado-atencion__detalle">
      {punto}
      <span
        className={`estado-atencion__horario${enHorario === false ? ' estado-atencion__horario--fuera' : ''}`}
      >
        {horarioTexto}
      </span>
      {estado.horario?.length > 0 && (
        <details className="estado-atencion__semana">
          <summary>Ver horario de atención</summary>
          <ul>
            {resumenHorario(estado.horario).map((g) => (
              <li key={g.dias}>
                <strong>{g.dias}:</strong> {g.horas}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

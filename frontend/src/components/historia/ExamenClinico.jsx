import { ACTITUDES, ORGANOS_SISTEMAS } from '../../utils/consultas.js';

/**
 * Bloques del formato de examen clínico (como el formato en papel):
 * motivo de consulta, examen clínico, órganos y sistemas y descripción de los hallazgos.
 * Se usan en la hoja de cada consulta y en la historia clínica.
 * Si no hay datos, se muestran los campos en blanco, como la hoja sin llenar.
 */

const conUnidad = (v, unidad) =>
  v === null || v === undefined || v === '' ? '' : `${v} ${unidad}`;
const marca = (si) => (si ? '( X )' : '(   )');

export function MotivoConsulta({ consulta, encabezado }) {
  return (
    <section className="formato__seccion formato__evitar-corte">
      <h2 className="formato__barra">Motivo de consulta</h2>
      <table className="formato__tabla">
        <tbody>
          {encabezado}
          <tr>
            <th scope="row">Motivo:</th>
            <td>
              <strong>{consulta?.motivo ?? ''}</strong>
            </td>
          </tr>
          <tr>
            <th scope="row">Anamnesis:</th>
            <td className="historia__texto">
              {consulta ? consulta.anamnesis || 'Sin registrar' : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export function ExamenClinicoTabla({ consulta }) {
  const c = consulta ?? {};
  return (
    <section className="formato__seccion formato__evitar-corte">
      <h2 className="formato__barra">Examen clínico</h2>
      <table className="formato__tabla formato__examen-tabla">
        <tbody>
          <tr>
            <td>
              <strong>F. Respiratoria:</strong>{' '}
              {conUnidad(c.frecuencia_respiratoria, '/rpm')}
            </td>
            <td>
              <strong>F. Cardiaca:</strong>{' '}
              {conUnidad(c.frecuencia_cardiaca, '/lpm')}
            </td>
            <td>
              <strong>Temperatura:</strong> {conUnidad(c.temperatura_c, '°C')}
            </td>
            <td>
              <strong>Pulso:</strong> {conUnidad(c.pulso, '/ppm')}
            </td>
          </tr>
          <tr>
            <td>
              <strong>Peso:</strong> {conUnidad(c.peso_kg, 'kg')}
            </td>
            <td>
              <strong>Tiempo llenado capilar:</strong>{' '}
              {conUnidad(c.tiempo_llenado_capilar, 's')}
            </td>
            <td colSpan={2}>
              <strong>Ganglios linfáticos:</strong>{' '}
              {c.ganglios_linfaticos || ''}
            </td>
          </tr>
          <tr>
            <td colSpan={1}>
              <strong>Mucosas:</strong> {c.mucosas || ''}
            </td>
            <td colSpan={3}>
              <strong>Actitud y temperamento:</strong>{' '}
              {ACTITUDES.map((a) => (
                <span key={a.valor} className="formato__opcion">
                  {a.etiqueta} {marca(c.actitud === a.valor)}
                  {a.valor === 'otro' &&
                    c.actitud === 'otro' &&
                    c.actitud_otro &&
                    `: ${c.actitud_otro}`}
                </span>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function OrganoCeldas({ organo, valor }) {
  return (
    <>
      <td>
        {organo.numero}. {organo.etiqueta}
      </td>
      <td className={`formato__organo formato__organo--${valor ?? 'vacio'}`}>
        {valor ?? ''}
      </td>
    </>
  );
}

/** Tabla de 12 órganos y sistemas en dos columnas, como el formato en papel. */
export function OrganosSistemas({ valores }) {
  const mitad = ORGANOS_SISTEMAS.length / 2;
  const filas = ORGANOS_SISTEMAS.slice(0, mitad).map((izq, i) => [
    { ...izq, numero: i + 1 },
    { ...ORGANOS_SISTEMAS[i + mitad], numero: i + 1 + mitad },
  ]);
  return (
    <section className="formato__seccion formato__evitar-corte">
      <table className="formato__tabla formato__tabla--lista formato__organos">
        <thead>
          <tr>
            <th>Órganos y sistemas</th>
            <th>N/AN/NE</th>
            <th>Órganos y sistemas</th>
            <th>N/AN/NE</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((par) => (
            <tr key={par[0].clave}>
              {par.map((o) => (
                <OrganoCeldas
                  key={o.clave}
                  organo={o}
                  valor={valores?.[o.clave]}
                />
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="formato__leyenda">
              N: Normal &nbsp;&nbsp; AN: Anormal &nbsp;&nbsp; NE: No examinado
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export function Hallazgos({ consulta }) {
  return (
    <section className="formato__seccion formato__evitar-corte">
      <h2 className="formato__barra">Descripción de los hallazgos</h2>
      {consulta ? (
        <p className="formato__vacio formato__texto historia__texto">
          {consulta.examen_fisico || 'Sin registrar'}
        </p>
      ) : (
        <div className="formato__renglones" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

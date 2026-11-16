import { calcularEdad, ETIQUETA_SEXO } from '../../utils/mascotas.js';
import { fechaCorta } from '../../utils/format.js';
import logo from '../../assets/logo-emblema.png';
import FotoMascota from '../FotoMascota.jsx';

const TIPO_DOCUMENTO = {
  CC: 'C.C.',
  CE: 'C.E.',
  TI: 'T.I.',
  PA: 'Pasaporte',
  NIT: 'NIT',
};

/** Filas "Etiqueta: valor" de una tabla del formato. */
export function Filas({ datos }) {
  return datos.map(([etiqueta, valor]) => (
    <tr key={etiqueta}>
      <th scope="row">{etiqueta}:</th>
      <td>{valor || '—'}</td>
    </tr>
  ));
}

/**
 * Encabezado del formato de historia clínica: logo, título, código y fecha.
 * Lo usan la historia clínica (Ep3-Hu12) y la hoja de cada consulta (Ep3-Hu13).
 */
export function EncabezadoDocumento({
  titulo = 'Historia Clínica',
  subtitulo,
  numero,
  etiquetaFecha,
  fecha,
}) {
  return (
    <>
      <table className="formato__encabezado">
        <tbody>
          <tr>
            <td className="formato__logo" rowSpan={2}>
              <img src={logo} alt="VetControl AI" />
            </td>
            <td className="formato__titulo" rowSpan={2}>
              <strong>{titulo}</strong>
              <span>VetControl AI</span>
              <span>{subtitulo}</span>
            </td>
            <th scope="row">Código</th>
            <td>{numero}</td>
          </tr>
          <tr>
            <th scope="row">{etiquetaFecha}</th>
            <td>{fecha}</td>
          </tr>
        </tbody>
      </table>

      <table className="formato__tabla formato__fecha">
        <tbody>
          <tr>
            <td>
              <strong>Fecha:</strong> {fecha}
            </td>
            <td>
              <strong>Número historia clínica:</strong> {numero}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

/** "Datos del propietario" y "Datos del paciente" (con la foto de la mascota). */
export function DatosPropietarioPaciente({ propietario, mascota }) {
  const documento = propietario.numero_documento
    ? `${TIPO_DOCUMENTO[propietario.tipo_documento] ?? propietario.tipo_documento} ${propietario.numero_documento}`
    : null;
  return (
    <div className="formato__datos">
      <section className="formato__seccion" aria-labelledby="prop-titulo">
        <h2 id="prop-titulo" className="formato__barra">
          Datos del propietario
        </h2>
        <table className="formato__tabla">
          <tbody>
            <Filas
              datos={[
                ['Nombres', `${propietario.nombre} ${propietario.apellido}`],
                ['Documento de identidad', documento],
                ['Dirección', propietario.direccion],
                ['Teléfono', propietario.telefono],
                ['Correo electrónico', propietario.correo],
              ]}
            />
          </tbody>
        </table>
      </section>

      <section className="formato__seccion" aria-labelledby="pac-titulo">
        <h2 id="pac-titulo" className="formato__barra">
          Datos del paciente
        </h2>
        <div className="formato__paciente">
          <table className="formato__tabla">
            <tbody>
              <Filas
                datos={[
                  ['Nombre', mascota.nombre],
                  ['Especie', mascota.especie],
                  ['Raza', mascota.raza],
                  [
                    'Sexo',
                    mascota.sexo === 'desconocido'
                      ? 'No registrado'
                      : ETIQUETA_SEXO[mascota.sexo],
                  ],
                  [
                    'Fecha de nacimiento',
                    mascota.fecha_nacimiento &&
                      `${fechaCorta(mascota.fecha_nacimiento)} (${calcularEdad(mascota.fecha_nacimiento)})`,
                  ],
                  ['Color', mascota.color],
                  ['Peso', mascota.peso_kg && `${mascota.peso_kg} kg`],
                  ['Microchip', mascota.microchip],
                ]}
              />
            </tbody>
          </table>
          <FotoMascota mascota={mascota} tamano={96} />
        </div>
      </section>
    </div>
  );
}

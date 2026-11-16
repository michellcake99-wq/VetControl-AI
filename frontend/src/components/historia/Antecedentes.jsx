import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../../services/api.js';
import Alerta from '../Alerta.jsx';

const CAMPOS = [
  { clave: 'alergias', etiqueta: 'Alergias', max: 2000 },
  {
    clave: 'enfermedades_cronicas',
    etiqueta: 'Enfermedades anteriores / crónicas',
    max: 2000,
  },
  { clave: 'antecedentes', etiqueta: 'Antecedentes', max: 5000 },
];

const valoresDe = (historia) =>
  Object.fromEntries(CAMPOS.map(({ clave }) => [clave, historia[clave] ?? '']));

const marca = (activo) => (activo ? '( X )' : '(   )');

/**
 * Ep3-Hu12: sección "Anamnésicos" de la historia clínica.
 * El veterinario puede editar los antecedentes; los demás roles los ven en modo lectura.
 */
export default function Antecedentes({
  historia,
  tratamientosActivos,
  puedeEditar,
  onGuardado,
}) {
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState(() => valoresDe(historia));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const { mascota } = historia;

  function empezarEdicion() {
    setValores(valoresDe(historia));
    setError('');
    setExito('');
    setEditando(true);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError('');
    try {
      // Un campo vacío se guarda como null ("sin registrar")
      const cambios = Object.fromEntries(
        CAMPOS.map(({ clave }) => [clave, valores[clave].trim() || null])
      );
      const actualizada = await api.put(
        `/historias/${historia.id_historia}`,
        cambios
      );
      onGuardado(actualizada);
      setEditando(false);
      setExito('Antecedentes actualizados correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los antecedentes');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="formato__seccion" aria-labelledby="ant-titulo">
      <h2 id="ant-titulo" className="formato__barra">
        Anamnésicos
        {puedeEditar && !editando && (
          <button
            type="button"
            className="formato__accion no-pdf"
            onClick={empezarEdicion}
          >
            <Pencil size={13} />
            Editar
          </button>
        )}
      </h2>

      <div className="no-pdf">
        <Alerta tipo="exito">{exito}</Alerta>
      </div>

      {editando ? (
        <form
          className="historia__form formato__form no-pdf"
          onSubmit={guardar}
        >
          {CAMPOS.map(({ clave, etiqueta, max }) => (
            <div className="campo" key={clave}>
              <label htmlFor={`ant-${clave}`}>{etiqueta}</label>
              <textarea
                id={`ant-${clave}`}
                rows={clave === 'antecedentes' ? 4 : 2}
                maxLength={max}
                value={valores[clave]}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [clave]: e.target.value }))
                }
              />
            </div>
          ))}
          <Alerta tipo="error">{error}</Alerta>
          <div className="formulario__acciones">
            <button
              type="button"
              className="boton boton--claro"
              onClick={() => setEditando(false)}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="boton boton--oscuro"
              disabled={guardando}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      ) : (
        <table className="formato__tabla">
          <tbody>
            {CAMPOS.map(({ clave, etiqueta }) => (
              <tr key={clave}>
                <th scope="row">{etiqueta}:</th>
                <td className="historia__texto">
                  {historia[clave] || 'Sin registrar'}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Tratamientos activos:</th>
              <td>
                {tratamientosActivos.length === 0
                  ? 'Ninguno'
                  : tratamientosActivos
                      .map(
                        (t) => `${t.medicamento} (${t.dosis}, ${t.frecuencia})`
                      )
                      .join('; ')}
              </td>
            </tr>
            <tr>
              <th scope="row">Historia reproductiva:</th>
              <td>
                Entero {marca(!mascota.esterilizado)} &nbsp;&nbsp; Esterilizado{' '}
                {marca(mascota.esterilizado)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

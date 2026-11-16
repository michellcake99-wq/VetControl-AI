import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../../services/api.js';
import { fechaCorta } from '../../utils/format.js';
import { estadoEnCarne } from '../../utils/vacunas.js';
import Alerta from '../Alerta.jsx';
import FormularioVacuna from './FormularioVacuna.jsx';

/**
 * Ep4-Hu1: carné de vacunación de una mascota, en orden cronológico.
 * El veterinario registra y corrige vacunas; los demás lo ven en modo lectura.
 */
export default function CarneVacunas({
  idHistoria,
  especie,
  vacunasIniciales,
  puedeEditar,
  onCambio,
}) {
  const [vacunas, setVacunas] = useState(vacunasIniciales);
  // null = sin formulario; { vacuna: null } = registrar; { vacuna } = corregir
  const [formulario, setFormulario] = useState(null);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  async function alGuardar(vacuna, eraCorreccion) {
    setFormulario(null);
    setExito(
      eraCorreccion
        ? `Se corrigió el registro de ${vacuna.nombre}.`
        : `${vacuna.nombre} quedó registrada en el carné.`
    );
    try {
      // Se vuelve a pedir el carné para mostrarlo en el orden correcto
      const lista = await api.get(`/historias/${idHistoria}/vacunas`);
      setVacunas(lista);
      onCambio?.(lista);
    } catch {
      setError(
        'La vacuna se guardó, pero no se pudo actualizar el carné. Recarga la página.'
      );
    }
  }

  return (
    <section
      id="vacunas"
      className="formato__seccion"
      aria-labelledby="vacunas-titulo"
    >
      <h2 id="vacunas-titulo" className="formato__barra">
        Vacunas (fecha / laboratorio / lote)
        {puedeEditar && !formulario && (
          <button
            type="button"
            className="formato__accion no-pdf"
            onClick={() => {
              setExito('');
              setFormulario({ vacuna: null });
            }}
          >
            <Plus size={13} />
            Registrar vacuna
          </button>
        )}
      </h2>

      <div className="no-pdf">
        <Alerta tipo="exito">{exito}</Alerta>
        <Alerta tipo="error">{error}</Alerta>
        {formulario && (
          <FormularioVacuna
            key={formulario.vacuna?.id_vacuna ?? 'nueva'}
            idHistoria={idHistoria}
            especie={especie}
            vacuna={formulario.vacuna}
            onGuardada={alGuardar}
            onCancelar={() => setFormulario(null)}
          />
        )}
      </div>

      {vacunas.length === 0 ? (
        <p className="formato__vacio">
          Esta mascota todavía no tiene vacunas registradas.
        </p>
      ) : (
        <table className="formato__tabla formato__tabla--lista carne">
          <thead>
            <tr>
              <th>Vacuna</th>
              <th>Aplicación</th>
              <th>Laboratorio</th>
              <th>Lote</th>
              <th>Próxima dosis</th>
              <th>Estado</th>
              {puedeEditar && (
                <th className="no-pdf">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {vacunas.map((v) => {
              const estado = estadoEnCarne(v, vacunas);
              return (
                <tr key={v.id_vacuna} className="carne__item">
                  <td>
                    <strong>{v.nombre}</strong>
                    {v.nombre_veterinario && (
                      <span className="formato__nota">
                        Aplicó: {v.nombre_veterinario}
                      </span>
                    )}
                    {v.observaciones && (
                      <span className="formato__nota">{v.observaciones}</span>
                    )}
                  </td>
                  <td>{fechaCorta(v.fecha_aplicacion)}</td>
                  <td>{v.laboratorio || '—'}</td>
                  <td>{v.lote || '—'}</td>
                  <td>{v.proxima_dosis ? fechaCorta(v.proxima_dosis) : '—'}</td>
                  <td>
                    <span className={`estado estado--${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </td>
                  {puedeEditar && (
                    <td className="no-pdf">
                      <button
                        type="button"
                        className="boton boton--claro boton--peq"
                        onClick={() => {
                          setExito('');
                          setFormulario({ vacuna: v });
                        }}
                        aria-label={`Corregir registro de ${v.nombre}`}
                      >
                        <Pencil size={14} />
                        Corregir
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
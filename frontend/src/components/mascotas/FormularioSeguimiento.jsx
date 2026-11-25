import { useState } from 'react';
import { api } from '../../services/api.js';
import { hoyISO } from '../../utils/format.js';
import Alerta from '../Alerta.jsx';

function validar({ peso_kg: peso, fecha }) {
  const errores = {};
  const kg = Number(peso.trim().replace(',', '.'));
  if (!peso.trim()) errores.peso_kg = 'El peso es obligatorio.';
  else if (!Number.isFinite(kg)) errores.peso_kg = 'Escribe un número válido.';
  else if (kg <= 0) errores.peso_kg = 'El peso debe ser mayor que cero.';
  else if (kg > 500) errores.peso_kg = 'El peso no puede superar 500 kg.';
  if (!fecha) errores.fecha = 'La fecha es obligatoria.';
  else if (fecha > hoyISO()) errores.fecha = 'La fecha no puede ser futura.';
  return errores;
}

/**
 * Ep4-Hu3: registrar el peso y las observaciones de una mascota.
 * Lo pueden usar el veterinario y el propietario (de sus mascotas).
 */
export default function FormularioSeguimiento({ idMascota, onGuardado }) {
  const [valores, setValores] = useState({
    peso_kg: '',
    fecha: hoyISO(),
    observaciones: '',
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    const encontrados = validar(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setGuardando(true);
    setErrorGeneral('');
    try {
      const registro = await api.post(`/mascotas/${idMascota}/seguimiento`, {
        peso_kg: Number(valores.peso_kg.trim().replace(',', '.')),
        fecha: valores.fecha,
        observaciones: valores.observaciones.trim() || null,
      });
      setValores({ peso_kg: '', fecha: hoyISO(), observaciones: '' });
      onGuardado(registro);
    } catch (err) {
      // Errores de validación del backend: se muestran junto a cada campo
      setErrores(
        Object.fromEntries(
          (err.detalles ?? []).map(({ campo, mensaje }) => [campo, mensaje])
        )
      );
      setErrorGeneral(err.message || 'No se pudo guardar el registro.');
    } finally {
      setGuardando(false);
    }
  }

  const claseCampo = (campo) => `campo${errores[campo] ? ' campo--error' : ''}`;
  const mensaje = (campo) =>
    errores[campo] && <span className="campo__error">{errores[campo]}</span>;

  return (
    <form className="seguimiento__form" onSubmit={guardar} noValidate>
      <div className="seguimiento__campos">
        <div className={claseCampo('peso_kg')}>
          <label htmlFor="seg-peso">Peso (kg) *</label>
          <input
            id="seg-peso"
            inputMode="decimal"
            placeholder="Ej: 28,5"
            value={valores.peso_kg}
            onChange={(e) => cambiar('peso_kg', e.target.value)}
            aria-invalid={Boolean(errores.peso_kg)}
          />
          {mensaje('peso_kg')}
        </div>

        <div className={claseCampo('fecha')}>
          <label htmlFor="seg-fecha">Fecha *</label>
          <input
            id="seg-fecha"
            type="date"
            max={hoyISO()}
            value={valores.fecha}
            onChange={(e) => cambiar('fecha', e.target.value)}
            aria-invalid={Boolean(errores.fecha)}
          />
          {mensaje('fecha')}
        </div>

        <div className={`${claseCampo('observaciones')} seguimiento__ancho`}>
          <label htmlFor="seg-obs">Observaciones</label>
          <textarea
            id="seg-obs"
            rows={2}
            maxLength={1000}
            placeholder="Apetito, energía, cambios que notaste…"
            value={valores.observaciones}
            onChange={(e) => cambiar('observaciones', e.target.value)}
          />
          {mensaje('observaciones')}
        </div>
      </div>

      <Alerta tipo="error">{errorGeneral}</Alerta>

      <div className="formulario__acciones">
        <button type="submit" className="boton boton--oscuro" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar'}
        </button>
      </div>
    </form>
  );
}

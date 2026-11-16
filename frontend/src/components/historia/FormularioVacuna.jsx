import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { hoyISO, sumarDias } from '../../utils/format.js';
import Alerta from '../Alerta.jsx';

const OTRA = 'otra';

function valoresIniciales(vacuna) {
  if (!vacuna) {
    return {
      vacuna: '',
      nombre: '',
      laboratorio: '',
      lote: '',
      fecha_aplicacion: hoyISO(),
      proxima_dosis: '',
      observaciones: '',
    };
  }
  return {
    vacuna: vacuna.id_catalogo ? String(vacuna.id_catalogo) : OTRA,
    nombre: vacuna.id_catalogo ? '' : vacuna.nombre,
    laboratorio: vacuna.laboratorio ?? '',
    lote: vacuna.lote ?? '',
    fecha_aplicacion: vacuna.fecha_aplicacion,
    proxima_dosis: vacuna.proxima_dosis ?? '',
    observaciones: vacuna.observaciones ?? '',
  };
}

function validar(v) {
  const errores = {};
  if (!v.vacuna) errores.vacuna = 'Elige una vacuna del catálogo.';
  if (v.vacuna === OTRA && !v.nombre.trim()) {
    errores.nombre = 'Escribe el nombre de la vacuna.';
  }
  if (!v.fecha_aplicacion) {
    errores.fecha_aplicacion = 'La fecha de aplicación es obligatoria.';
  } else if (v.fecha_aplicacion > hoyISO()) {
    errores.fecha_aplicacion = 'La fecha de aplicación no puede ser futura.';
  }
  if (
    v.proxima_dosis &&
    v.fecha_aplicacion &&
    v.proxima_dosis <= v.fecha_aplicacion
  ) {
    errores.proxima_dosis =
      'La próxima dosis debe ser posterior a la fecha de aplicación.';
  }
  return errores;
}

// Los nombres de campo del backend que no coinciden con los del formulario
const CAMPO_FORMULARIO = { id_catalogo: 'vacuna' };

/**
 * Ep4-Hu1: registrar o corregir una vacuna (solo veterinario).
 * La vacuna se elige del catálogo; al elegirla se sugiere la próxima dosis
 * según el refuerzo del catálogo (se puede cambiar).
 */
export default function FormularioVacuna({
  idHistoria,
  especie,
  vacuna,
  onGuardada,
  onCancelar,
}) {
  const editando = Boolean(vacuna);
  const [catalogo, setCatalogo] = useState([]);
  const [valores, setValores] = useState(() => valoresIniciales(vacuna));
  // Si la próxima dosis la calculó el formulario, se recalcula al cambiar la vacuna o la fecha
  const [proximaSugerida, setProximaSugerida] = useState(!editando);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/vacunas/catalogo?especie=${encodeURIComponent(especie)}`)
      .then((lista) => {
        if (!cancelado) setCatalogo(lista);
      })
      .catch(() => {
        if (!cancelado)
          setErrorGeneral('No se pudo cargar el catálogo de vacunas.');
      });
    return () => {
      cancelado = true;
    };
  }, [especie]);

  function proximaPara(idVacuna, fechaAplicacion) {
    const elegida = catalogo.find((c) => String(c.id_catalogo) === idVacuna);
    return elegida?.dias_refuerzo && fechaAplicacion
      ? sumarDias(fechaAplicacion, elegida.dias_refuerzo)
      : '';
  }

  function cambiar(campo, valor) {
    setValores((v) => {
      const nuevos = { ...v, [campo]: valor };
      if (
        proximaSugerida &&
        (campo === 'vacuna' || campo === 'fecha_aplicacion')
      ) {
        nuevos.proxima_dosis = proximaPara(
          nuevos.vacuna,
          nuevos.fecha_aplicacion
        );
      }
      return nuevos;
    });
    if (campo === 'proxima_dosis') setProximaSugerida(false);
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    const encontrados = validar(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const esOtra = valores.vacuna === OTRA;
    const cuerpo = {
      ...(esOtra
        ? { id_catalogo: null, nombre: valores.nombre.trim() }
        : { id_catalogo: Number(valores.vacuna) }),
      laboratorio: valores.laboratorio.trim() || null,
      lote: valores.lote.trim() || null,
      fecha_aplicacion: valores.fecha_aplicacion,
      proxima_dosis: valores.proxima_dosis || null,
      observaciones: valores.observaciones.trim() || null,
    };

    setGuardando(true);
    setErrorGeneral('');
    try {
      const guardada = editando
        ? await api.put(`/vacunas/${vacuna.id_vacuna}`, cuerpo)
        : await api.post(`/historias/${idHistoria}/vacunas`, cuerpo);
      onGuardada(guardada, editando);
    } catch (err) {
      // Errores de validación del backend: se muestran junto a cada campo
      const delServidor = Object.fromEntries(
        (err.detalles ?? []).map(({ campo, mensaje }) => [
          CAMPO_FORMULARIO[campo] ?? campo,
          mensaje,
        ])
      );
      setErrores(delServidor);
      setErrorGeneral(err.message || 'No se pudo guardar la vacuna.');
    } finally {
      setGuardando(false);
    }
  }

  const claseCampo = (campo) => `campo${errores[campo] ? ' campo--error' : ''}`;
  const mensaje = (campo) =>
    errores[campo] && (
      <span className="campo__error" id={`err-${campo}`}>
        {errores[campo]}
      </span>
    );
  const descripcion = catalogo.find(
    (c) => String(c.id_catalogo) === valores.vacuna
  )?.descripcion;

  return (
    <form className="carne__form" onSubmit={guardar} noValidate>
      <h3 className="consulta__subtitulo">
        {editando ? 'Corregir registro de vacuna' : 'Registrar vacuna'}
      </h3>

      <div className="carne__campos">
        <div className={claseCampo('vacuna')}>
          <label htmlFor="vac-vacuna">Vacuna *</label>
          <select
            id="vac-vacuna"
            value={valores.vacuna}
            onChange={(e) => cambiar('vacuna', e.target.value)}
            aria-invalid={Boolean(errores.vacuna)}
          >
            <option value="">Elige una vacuna…</option>
            {catalogo.map((c) => (
              <option key={c.id_catalogo} value={c.id_catalogo}>
                {c.nombre}
              </option>
            ))}
            <option value={OTRA}>Otra (no está en el catálogo)</option>
          </select>
          {descripcion && <span className="texto-sec">{descripcion}</span>}
          {mensaje('vacuna')}
        </div>

        {valores.vacuna === OTRA && (
          <div className={claseCampo('nombre')}>
            <label htmlFor="vac-nombre">Nombre de la vacuna *</label>
            <input
              id="vac-nombre"
              maxLength={100}
              value={valores.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
            />
            {mensaje('nombre')}
          </div>
        )}

        <div className={claseCampo('fecha_aplicacion')}>
          <label htmlFor="vac-aplicacion">Fecha de aplicación *</label>
          <input
            id="vac-aplicacion"
            type="date"
            max={hoyISO()}
            value={valores.fecha_aplicacion}
            onChange={(e) => cambiar('fecha_aplicacion', e.target.value)}
          />
          {mensaje('fecha_aplicacion')}
        </div>

        <div className={claseCampo('proxima_dosis')}>
          <label htmlFor="vac-proxima">Próxima dosis</label>
          <input
            id="vac-proxima"
            type="date"
            min={valores.fecha_aplicacion || undefined}
            value={valores.proxima_dosis}
            onChange={(e) => cambiar('proxima_dosis', e.target.value)}
          />
          {proximaSugerida && valores.proxima_dosis && (
            <span className="texto-sec">Sugerida según el catálogo.</span>
          )}
          {mensaje('proxima_dosis')}
        </div>

        <div className={claseCampo('laboratorio')}>
          <label htmlFor="vac-laboratorio">Laboratorio</label>
          <input
            id="vac-laboratorio"
            maxLength={100}
            value={valores.laboratorio}
            onChange={(e) => cambiar('laboratorio', e.target.value)}
          />
          {mensaje('laboratorio')}
        </div>

        <div className={claseCampo('lote')}>
          <label htmlFor="vac-lote">Lote</label>
          <input
            id="vac-lote"
            maxLength={50}
            value={valores.lote}
            onChange={(e) => cambiar('lote', e.target.value)}
          />
          {mensaje('lote')}
        </div>

        <div className={`${claseCampo('observaciones')} carne__campo-ancho`}>
          <label htmlFor="vac-obs">Observaciones</label>
          <textarea
            id="vac-obs"
            rows={2}
            maxLength={1000}
            value={valores.observaciones}
            onChange={(e) => cambiar('observaciones', e.target.value)}
          />
          {mensaje('observaciones')}
        </div>
      </div>

      <Alerta tipo="error">{errorGeneral}</Alerta>

      <div className="formulario__acciones">
        <button
          type="button"
          className="boton boton--claro"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="boton boton--oscuro"
          disabled={guardando}
        >
          {guardando
            ? 'Guardando…'
            : editando
              ? 'Guardar corrección'
              : 'Registrar vacuna'}
        </button>
      </div>
    </form>
  );
}

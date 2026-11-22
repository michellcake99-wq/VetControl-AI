import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api.js';
import { aISO, fechaCorta, hoyISO } from '../utils/format.js';
import {
  ACTITUDES,
  lista,
  ORGANOS_SISTEMAS,
  VALORES_ORGANO,
} from '../utils/consultas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import BotonVolver from '../components/BotonVolver.jsx';

// Campos numéricos del examen clínico: [campo, etiqueta, unidad, mínimo, máximo, entero]
const SIGNOS = [
  ['frecuencia_respiratoria', 'F. respiratoria', 'rpm', 1, 200, true],
  ['frecuencia_cardiaca', 'F. cardiaca', 'lpm', 1, 400, true],
  ['temperatura_c', 'Temperatura', '°C', 30, 45, false],
  ['pulso', 'Pulso', 'ppm', 1, 400, true],
  ['peso_kg', 'Peso', 'kg', 0.01, 2000, false],
  ['tiempo_llenado_capilar', 'Tiempo llenado capilar', 's', 0.1, 10, false],
];
const TEXTOS = [
  'motivo',
  'anamnesis',
  'ganglios_linfaticos',
  'mucosas',
  'actitud',
  'actitud_otro',
  'examen_fisico',
  'diagnostico',
  'observaciones',
  'proximo_control',
];

const TRATAMIENTO_VACIO = {
  medicamento: '',
  dosis: '',
  frecuencia: '',
  via: '',
  fecha_inicio: hoyISO(),
  fecha_fin: '',
  indicaciones: '',
};

/** Date -> 'AAAA-MM-DDTHH:MM' en hora local (para input datetime-local) */
const aFechaHoraLocal = (d) =>
  `${aISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function valoresIniciales(consulta) {
  const v = {
    id_mascota: '',
    fecha: aFechaHoraLocal(new Date()),
    organos_sistemas: {},
  };
  for (const [campo] of SIGNOS) v[campo] = consulta?.[campo] ?? '';
  for (const campo of TEXTOS) v[campo] = consulta?.[campo] ?? '';
  if (consulta) {
    v.id_mascota = String(consulta.mascota.id_mascota);
    v.fecha = aFechaHoraLocal(new Date(consulta.fecha));
    v.organos_sistemas = consulta.organos_sistemas ?? {};
  }
  return v;
}

function validar(v, tratamientos, editando) {
  const e = {};
  if (!editando && !v.id_mascota)
    e.id_mascota = 'Elige la mascota que se atiende.';
  if (!v.fecha) e.fecha = 'La fecha y hora son obligatorias.';
  else if (new Date(v.fecha) > new Date(Date.now() + 5 * 60000)) {
    e.fecha = 'La consulta no puede quedar en el futuro.';
  }
  if (!v.motivo.trim()) e.motivo = 'El motivo de consulta es obligatorio.';
  if (!v.diagnostico.trim()) e.diagnostico = 'El diagnóstico es obligatorio.';
  for (const [campo, etiqueta, unidad, min, max, entero] of SIGNOS) {
    if (v[campo] === '' || v[campo] === null) continue;
    const n = Number(v[campo]);
    if (Number.isNaN(n) || n < min || n > max) {
      e[campo] = `${etiqueta}: entre ${min} y ${max} ${unidad}.`;
    } else if (entero && !Number.isInteger(n)) {
      e[campo] = `${etiqueta} debe ser un número entero.`;
    }
  }
  if (v.actitud === 'otro' && !v.actitud_otro.trim()) {
    e.actitud_otro = 'Describe la actitud.';
  }
  if (
    v.proximo_control &&
    v.fecha &&
    v.proximo_control < v.fecha.slice(0, 10)
  ) {
    e.proximo_control = 'El próximo control no puede ser antes de la consulta.';
  }
  tratamientos.forEach((t, i) => {
    for (const campo of ['medicamento', 'dosis', 'frecuencia']) {
      if (!t[campo].trim()) e[`t${i}_${campo}`] = 'Obligatorio.';
    }
    if (t.fecha_fin && t.fecha_inicio && t.fecha_fin < t.fecha_inicio) {
      e[`t${i}_fecha_fin`] = 'No puede ser antes del inicio.';
    }
  });
  return e;
}

/** Convierte el formulario al cuerpo que espera la API. */
function cuerpoConsulta(v, editando) {
  const vacio = editando ? null : undefined; // al editar, un campo vacío lo borra
  const cuerpo = { fecha: new Date(v.fecha).toISOString() };
  for (const [campo] of SIGNOS) {
    cuerpo[campo] = v[campo] === '' ? vacio : Number(v[campo]);
  }
  for (const campo of TEXTOS) {
    const texto = String(v[campo] ?? '').trim();
    cuerpo[campo] = texto || vacio;
  }
  if (v.actitud !== 'otro') cuerpo.actitud_otro = vacio;
  const organos = Object.fromEntries(
    Object.entries(v.organos_sistemas).filter(([, valor]) => valor)
  );
  cuerpo.organos_sistemas = Object.keys(organos).length ? organos : vacio;
  return cuerpo;
}

/**
 * Ep3-Hu13: registrar o editar una consulta con el examen clínico completo
 * y sus tratamientos. Solo el veterinario (y solo el que la registró puede editarla).
 */
export default function ConsultaFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const [parametros] = useSearchParams();
  const navegar = useNavigate();

  const [consulta, setConsulta] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [valores, setValores] = useState(() => ({
    ...valoresIniciales(null),
    id_mascota: parametros.get('mascota') ?? '',
  }));
  const [tratamientos, setTratamientos] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (editando) {
          const datos = await api.get(`/consultas/${id}`);
          if (cancelado) return;
          if (!datos.puede_editar) {
            setErrorGeneral(
              'Solo el veterinario que registró esta consulta la puede editar.'
            );
          }
          setConsulta(datos);
          setValores(valoresIniciales(datos));
        } else {
          const r = await api.get('/mascotas?limite=100');
          if (!cancelado) setMascotas(lista(r));
        }
      } catch (err) {
        if (!cancelado)
          setErrorGeneral(err.message || 'No se pudo cargar la información.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [editando, id]);

  const mascotaElegida = useMemo(
    () => mascotas.find((m) => String(m.id_mascota) === valores.id_mascota),
    [mascotas, valores.id_mascota]
  );

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function marcarOrgano(clave, valor) {
    setValores((v) => ({
      ...v,
      // Tocar de nuevo el valor elegido lo deja sin marcar
      organos_sistemas: {
        ...v.organos_sistemas,
        [clave]: v.organos_sistemas[clave] === valor ? undefined : valor,
      },
    }));
  }

  function cambiarTratamiento(i, campo, valor) {
    setTratamientos((lista) =>
      lista.map((t, j) => (j === i ? { ...t, [campo]: valor } : t))
    );
    setErrores((e) => ({ ...e, [`t${i}_${campo}`]: undefined }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setErrorGeneral('');
    const encontrados = validar(valores, tratamientos, editando);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErrorGeneral('Revisa los campos marcados en rojo.');
      return;
    }

    setGuardando(true);
    let guardada;
    try {
      guardada = editando
        ? await api.put(`/consultas/${id}`, cuerpoConsulta(valores, true))
        : await api.post(`/historias/${mascotaElegida.id_historia}/consultas`, {
            ...cuerpoConsulta(valores, false),
            // Ep5-Hu6: viene de completar una cita; la consulta queda asociada a ella
            ...(parametros.get('cita') && {
              id_cita: Number(parametros.get('cita')),
            }),
          });
    } catch (err) {
      // Errores de validación del backend junto a cada campo
      setErrores(
        Object.fromEntries(
          (err.detalles ?? []).map(({ campo, mensaje }) => [
            campo.split('.')[0],
            mensaje,
          ])
        )
      );
      setErrorGeneral(err.message || 'No se pudo guardar la consulta.');
      setGuardando(false);
      return;
    }

    // Tratamientos nuevos de esta consulta
    const fallidos = [];
    for (const t of tratamientos) {
      try {
        await api.post(`/consultas/${guardada.id_consulta}/tratamientos`, {
          medicamento: t.medicamento.trim(),
          dosis: t.dosis.trim(),
          frecuencia: t.frecuencia.trim(),
          via: t.via.trim() || undefined,
          fecha_inicio: t.fecha_inicio || undefined,
          fecha_fin: t.fecha_fin || undefined,
          indicaciones: t.indicaciones.trim() || undefined,
        });
      } catch {
        fallidos.push(t.medicamento);
      }
    }
    navegar(`/consultas/${guardada.id_consulta}`, {
      state: {
        mensaje: editando
          ? 'Consulta actualizada correctamente.'
          : 'Consulta registrada correctamente.',
        aviso: fallidos.length
          ? `No se pudieron guardar estos tratamientos: ${fallidos.join(', ')}. Agrégalos editando la consulta.`
          : '',
      },
    });
  }

  if (cargando) return <CargandoInline texto="Cargando…" />;

  const clase = (campo) => `campo${errores[campo] ? ' campo--error' : ''}`;
  const error = (campo) =>
    errores[campo] && <span className="campo__error">{errores[campo]}</span>;
  const nombrePaciente = consulta?.mascota.nombre ?? mascotaElegida?.nombre;

  return (
    <section>
      <BotonVolver a="/consultas" texto="Volver" />
      <h1 className="saludo__titulo">
        {editando ? 'Editar consulta' : 'Nueva consulta'}
      </h1>
      <p className="texto-sec">
        {nombrePaciente
          ? `Paciente: ${nombrePaciente}`
          : 'Registra la atención y el examen clínico del paciente.'}
      </p>
      <Alerta tipo="error">{errorGeneral}</Alerta>

      <form
        className="formulario formulario--ancho tarjeta"
        onSubmit={guardar}
        noValidate
      >
        {/* ---------------- Paciente y fecha ---------------- */}
        <h2 className="formulario__seccion">Paciente</h2>
        <div className="campos-grid">
          {editando ? (
            <div className="campo">
              <span className="campo__etiqueta">Mascota</span>
              <p>
                {consulta.mascota.nombre} · {consulta.numero_historia}
              </p>
            </div>
          ) : (
            <div className={clase('id_mascota')}>
              <label htmlFor="c-mascota">Mascota *</label>
              <select
                id="c-mascota"
                value={valores.id_mascota}
                onChange={(e) => cambiar('id_mascota', e.target.value)}
              >
                <option value="">Elige la mascota…</option>
                {mascotas.map((m) => (
                  <option key={m.id_mascota} value={m.id_mascota}>
                    {m.nombre} ({m.especie}) · {m.nombre_propietario}
                  </option>
                ))}
              </select>
              {error('id_mascota')}
            </div>
          )}
          <div className={clase('fecha')}>
            <label htmlFor="c-fecha">Fecha y hora *</label>
            <input
              id="c-fecha"
              type="datetime-local"
              value={valores.fecha}
              onChange={(e) => cambiar('fecha', e.target.value)}
            />
            {error('fecha')}
          </div>
        </div>

        {/* ---------------- Motivo ---------------- */}
        <h2 className="formulario__seccion">Motivo de consulta</h2>
        <div className={clase('motivo')}>
          <label htmlFor="c-motivo">Motivo *</label>
          <input
            id="c-motivo"
            maxLength={200}
            value={valores.motivo}
            onChange={(e) => cambiar('motivo', e.target.value)}
          />
          {error('motivo')}
        </div>
        <div className={clase('anamnesis')}>
          <label htmlFor="c-anamnesis">Anamnesis</label>
          <textarea
            id="c-anamnesis"
            rows={2}
            value={valores.anamnesis}
            onChange={(e) => cambiar('anamnesis', e.target.value)}
          />
        </div>

        {/* ---------------- Examen clínico ---------------- */}
        <h2 className="formulario__seccion">Examen clínico</h2>
        <div className="campos-grid campos-grid--3">
          {SIGNOS.map(([campo, etiqueta, unidad, min, max, entero]) => (
            <div className={clase(campo)} key={campo}>
              <label htmlFor={`c-${campo}`}>
                {etiqueta} ({unidad})
              </label>
              <input
                id={`c-${campo}`}
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={entero ? 1 : 0.1}
                value={valores[campo]}
                onChange={(e) => cambiar(campo, e.target.value)}
              />
              {error(campo)}
            </div>
          ))}
        </div>
        <div className="campos-grid">
          <div className={clase('ganglios_linfaticos')}>
            <label htmlFor="c-ganglios">Ganglios linfáticos</label>
            <input
              id="c-ganglios"
              maxLength={300}
              value={valores.ganglios_linfaticos}
              onChange={(e) => cambiar('ganglios_linfaticos', e.target.value)}
            />
          </div>
          <div className={clase('mucosas')}>
            <label htmlFor="c-mucosas">Mucosas</label>
            <input
              id="c-mucosas"
              maxLength={200}
              placeholder="Rosadas, húmedas…"
              value={valores.mucosas}
              onChange={(e) => cambiar('mucosas', e.target.value)}
            />
          </div>
        </div>
        <fieldset className="campo grupo-opciones">
          <legend>Actitud y temperamento</legend>
          <div className="grupo-opciones__lista">
            {ACTITUDES.map((a) => (
              <label key={a.valor} className="opcion">
                <input
                  type="radio"
                  name="actitud"
                  value={a.valor}
                  checked={valores.actitud === a.valor}
                  onChange={() => cambiar('actitud', a.valor)}
                />
                {a.etiqueta}
              </label>
            ))}
            {valores.actitud && (
              <button
                type="button"
                className="enlace-boton"
                onClick={() => cambiar('actitud', '')}
              >
                Quitar
              </button>
            )}
          </div>
          {valores.actitud === 'otro' && (
            <div className={clase('actitud_otro')}>
              <label htmlFor="c-actitud-otro">¿Cuál?</label>
              <input
                id="c-actitud-otro"
                maxLength={100}
                value={valores.actitud_otro}
                onChange={(e) => cambiar('actitud_otro', e.target.value)}
              />
              {error('actitud_otro')}
            </div>
          )}
        </fieldset>

        {/* ---------------- Órganos y sistemas ---------------- */}
        <h2 className="formulario__seccion">
          Órganos y sistemas
          <span className="formulario__seccion-acciones">
            <button
              type="button"
              className="enlace-boton"
              onClick={() =>
                cambiar(
                  'organos_sistemas',
                  Object.fromEntries(
                    ORGANOS_SISTEMAS.map((o) => [o.clave, 'N'])
                  )
                )
              }
            >
              Marcar todos como normal
            </button>
            <button
              type="button"
              className="enlace-boton"
              onClick={() => cambiar('organos_sistemas', {})}
            >
              Limpiar
            </button>
          </span>
        </h2>
        <p className="texto-sec">
          N: Normal · AN: Anormal · NE: No examinado. Toca otra vez para
          desmarcar.
        </p>
        <div className="organos">
          {ORGANOS_SISTEMAS.map((o, i) => (
            <div key={o.clave} className="organos__fila">
              <span className="organos__nombre">
                {i + 1}. {o.etiqueta}
              </span>
              <div
                className="organos__opciones"
                role="group"
                aria-label={o.etiqueta}
              >
                {VALORES_ORGANO.map(({ valor, etiqueta }) => (
                  <button
                    key={valor}
                    type="button"
                    title={etiqueta}
                    className={`organos__boton organos__boton--${valor}`}
                    aria-pressed={valores.organos_sistemas[o.clave] === valor}
                    onClick={() => marcarOrgano(o.clave, valor)}
                  >
                    {valor}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ---------------- Hallazgos y diagnóstico ---------------- */}
        <h2 className="formulario__seccion">Hallazgos y diagnóstico</h2>
        <div className={clase('examen_fisico')}>
          <label htmlFor="c-hallazgos">Descripción de los hallazgos</label>
          <textarea
            id="c-hallazgos"
            rows={3}
            value={valores.examen_fisico}
            onChange={(e) => cambiar('examen_fisico', e.target.value)}
          />
        </div>
        <div className={clase('diagnostico')}>
          <label htmlFor="c-diagnostico">Diagnóstico *</label>
          <textarea
            id="c-diagnostico"
            rows={2}
            value={valores.diagnostico}
            onChange={(e) => cambiar('diagnostico', e.target.value)}
          />
          {error('diagnostico')}
        </div>
        <div className="campos-grid">
          <div className={clase('observaciones')}>
            <label htmlFor="c-observaciones">Observaciones</label>
            <textarea
              id="c-observaciones"
              rows={2}
              value={valores.observaciones}
              onChange={(e) => cambiar('observaciones', e.target.value)}
            />
          </div>
          <div className={clase('proximo_control')}>
            <label htmlFor="c-control">Próximo control</label>
            <input
              id="c-control"
              type="date"
              value={valores.proximo_control}
              onChange={(e) => cambiar('proximo_control', e.target.value)}
            />
            {error('proximo_control')}
          </div>
        </div>

        {/* ---------------- Tratamientos ---------------- */}
        <h2 className="formulario__seccion">Tratamientos</h2>
        {consulta?.tratamientos.length > 0 && (
          <ul className="tratamientos-existentes">
            {consulta.tratamientos.map((t) => (
              <li key={t.id_tratamiento}>
                <strong>{t.medicamento}</strong> · {t.dosis} · {t.frecuencia} ·
                desde {fechaCorta(t.fecha_inicio)}{' '}
                <span className={`estado estado--${t.estado}`}>{t.estado}</span>
              </li>
            ))}
            <li className="texto-sec">
              El estado de estos tratamientos se cambia desde la hoja de la
              consulta.
            </li>
          </ul>
        )}
        {tratamientos.map((t, i) => (
          <div className="tratamiento-form" key={i}>
            <div className="campos-grid campos-grid--3">
              {[
                ['medicamento', 'Medicamento *'],
                ['dosis', 'Dosis *'],
                ['frecuencia', 'Frecuencia *'],
                ['via', 'Vía'],
              ].map(([campo, etiqueta]) => (
                <div className={clase(`t${i}_${campo}`)} key={campo}>
                  <label htmlFor={`t${i}-${campo}`}>{etiqueta}</label>
                  <input
                    id={`t${i}-${campo}`}
                    value={t[campo]}
                    onChange={(e) =>
                      cambiarTratamiento(i, campo, e.target.value)
                    }
                  />
                  {error(`t${i}_${campo}`)}
                </div>
              ))}
              <div className="campo">
                <label htmlFor={`t${i}-inicio`}>Inicio</label>
                <input
                  id={`t${i}-inicio`}
                  type="date"
                  value={t.fecha_inicio}
                  onChange={(e) =>
                    cambiarTratamiento(i, 'fecha_inicio', e.target.value)
                  }
                />
              </div>
              <div className={clase(`t${i}_fecha_fin`)}>
                <label htmlFor={`t${i}-fin`}>Fin</label>
                <input
                  id={`t${i}-fin`}
                  type="date"
                  value={t.fecha_fin}
                  onChange={(e) =>
                    cambiarTratamiento(i, 'fecha_fin', e.target.value)
                  }
                />
                {error(`t${i}_fecha_fin`)}
              </div>
            </div>
            <div className="campo">
              <label htmlFor={`t${i}-indicaciones`}>Indicaciones</label>
              <input
                id={`t${i}-indicaciones`}
                value={t.indicaciones}
                onChange={(e) =>
                  cambiarTratamiento(i, 'indicaciones', e.target.value)
                }
              />
            </div>
            <button
              type="button"
              className="boton boton--claro boton--peq"
              onClick={() =>
                setTratamientos((lista) => lista.filter((_, j) => j !== i))
              }
            >
              <Trash2 size={14} />
              Quitar tratamiento
            </button>
          </div>
        ))}
        <button
          type="button"
          className="boton boton--claro boton--peq"
          onClick={() =>
            setTratamientos((lista) => [...lista, { ...TRATAMIENTO_VACIO }])
          }
        >
          <Plus size={14} />
          Agregar tratamiento
        </button>

        <div className="formulario__acciones">
          <Link
            to={editando ? `/consultas/${id}` : '/consultas'}
            className="boton boton--claro"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="boton boton--oscuro"
            disabled={guardando || (editando && !consulta?.puede_editar)}
          >
            {guardando
              ? 'Guardando…'
              : editando
                ? 'Guardar cambios'
                : 'Registrar consulta'}
          </button>
        </div>
      </form>
    </section>
  );
}
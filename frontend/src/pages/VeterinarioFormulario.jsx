import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';

// 1 = lunes ... 7 = domingo (coincide con el CHECK de horarios_veterinario en schema.sql)
const DIAS = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

const VALORES_INICIALES = {
  nombre: '',
  apellido: '',
  correo: '',
  contrasena: '',
  tarjeta_profesional: '',
  especialidad: '',
  telefono: '',
};

export default function VeterinarioFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');

  const [horarios, setHorarios] = useState([]);
  // dia_semana '1' = lunes, consistente con el backend
  const [nuevoHorario, setNuevoHorario] = useState({
    dia_semana: '1',
    hora_inicio: '08:00',
    hora_fin: '17:00',
  });
  const [errorHorario, setErrorHorario] = useState('');
  const [mensajeHorario, setMensajeHorario] = useState('');

  async function cargarHorarios() {
    try {
      const r = await api.get(`/veterinarios/${id}/horarios`);
      setHorarios(Array.isArray(r) ? r : (r?.datos ?? []));
    } catch {
      // No es bloqueante para poder seguir editando el perfil del veterinario
    }
  }

  useEffect(() => {
    // Al crear no hay nada que cargar (cargando ya empieza en false)
    if (!editando) return;
    api
      .get(`/veterinarios/${id}`)
      .then((v) =>
        setValores({
          nombre: v.nombre ?? '',
          apellido: v.apellido ?? '',
          correo: v.correo ?? '',
          contrasena: '',
          tarjeta_profesional: v.tarjeta_profesional ?? '',
          especialidad: v.especialidad ?? '',
          telefono: v.telefono ?? '',
        })
      )
      .catch((err) =>
        setErrorGeneral(err.message || 'No se pudo cargar el veterinario')
      )
      .finally(() => setCargando(false));
    api
      .get(`/veterinarios/${id}/horarios`)
      .then((r) => setHorarios(Array.isArray(r) ? r : (r?.datos ?? [])))
      .catch(() => {
        // No es bloqueante para poder seguir editando el perfil del veterinario
      });
  }, [editando, id]);

  function actualizarCampo(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function validar() {
    const nuevosErrores = {};
    if (!valores.nombre.trim())
      nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!valores.apellido.trim())
      nuevosErrores.apellido = 'El apellido es obligatorio';
    if (!/^\S+@\S+\.\S+$/.test(valores.correo))
      nuevosErrores.correo = 'Correo inválido';
    if (!editando && valores.contrasena.length < 8)
      nuevosErrores.contrasena = 'Mínimo 8 caracteres';
    if (!valores.tarjeta_profesional.trim())
      nuevosErrores.tarjeta_profesional =
        'La tarjeta profesional es obligatoria';
    if (!valores.especialidad.trim())
      nuevosErrores.especialidad = 'La especialidad es obligatoria';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function enviar(e) {
    e.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;
    setGuardando(true);
    try {
      // El teléfono es opcional: si está vacío no se envía (el backend rechaza '' como teléfono inválido)
      const { telefono, ...resto } = valores;
      const datos = telefono.trim()
        ? { ...resto, telefono: telefono.trim() }
        : resto;
      if (editando) {
        // El correo y la contraseña no se cambian desde la edición
        const editable = { ...datos };
        delete editable.correo;
        delete editable.contrasena;
        await api.put(`/veterinarios/${id}`, editable);
        navegar('/veterinarios', {
          state: { mensaje: 'Veterinario actualizado correctamente.' },
        });
      } else {
        await api.post('/veterinarios', datos);
        navegar('/veterinarios', {
          state: { mensaje: 'Veterinario registrado correctamente.' },
        });
      }
    } catch (err) {
      // El backend responde 409 si la tarjeta profesional o el correo ya existen
      setErrorGeneral(err.message || 'No se pudo guardar el veterinario');
    } finally {
      setGuardando(false);
    }
  }

  async function agregarHorario(e) {
    e.preventDefault();
    setErrorHorario('');
    setMensajeHorario('');
    try {
      await api.post(`/veterinarios/${id}/horarios`, {
        dia_semana: Number(nuevoHorario.dia_semana),
        hora_inicio: nuevoHorario.hora_inicio,
        hora_fin: nuevoHorario.hora_fin,
      });
      setMensajeHorario('Horario agregado correctamente.');
      await cargarHorarios();
    } catch (err) {
      setErrorHorario(err.message || 'No se pudo agregar el horario');
    }
  }

  async function eliminarHorario(idHorario) {
    setErrorHorario('');
    setMensajeHorario('');
    try {
      await api.delete(`/veterinarios/${id}/horarios/${idHorario}`);
      setMensajeHorario('Horario eliminado correctamente.');
      await cargarHorarios();
    } catch (err) {
      setErrorHorario(err.message || 'No se pudo eliminar el horario');
    }
  }

  if (cargando)
    return <CargandoInline texto="Cargando datos del veterinario…" />;

  return (
    <section>
      <h1 className="saludo__titulo">
        {editando ? 'Editar veterinario' : 'Registrar veterinario'}
      </h1>
      <Alerta tipo="error">{errorGeneral}</Alerta>

      <form className="formulario tarjeta" onSubmit={enviar} noValidate>
        <div className={`campo${errores.nombre ? ' campo--error' : ''}`}>
          <label htmlFor="nombre">Nombre *</label>
          <input
            id="nombre"
            value={valores.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
          />
          {errores.nombre && (
            <span className="campo__error">{errores.nombre}</span>
          )}
        </div>

        <div className={`campo${errores.apellido ? ' campo--error' : ''}`}>
          <label htmlFor="apellido">Apellido *</label>
          <input
            id="apellido"
            value={valores.apellido}
            onChange={(e) => actualizarCampo('apellido', e.target.value)}
          />
          {errores.apellido && (
            <span className="campo__error">{errores.apellido}</span>
          )}
        </div>

        <div className={`campo${errores.correo ? ' campo--error' : ''}`}>
          <label htmlFor="correo">Correo *</label>
          <input
            id="correo"
            type="email"
            value={valores.correo}
            onChange={(e) => actualizarCampo('correo', e.target.value)}
            disabled={editando}
          />
          {errores.correo && (
            <span className="campo__error">{errores.correo}</span>
          )}
        </div>

        {!editando && (
          <div className={`campo${errores.contrasena ? ' campo--error' : ''}`}>
            <label htmlFor="contrasena">Contraseña temporal *</label>
            <input
              id="contrasena"
              type="password"
              value={valores.contrasena}
              onChange={(e) => actualizarCampo('contrasena', e.target.value)}
            />
            {errores.contrasena && (
              <span className="campo__error">{errores.contrasena}</span>
            )}
          </div>
        )}

        <div
          className={`campo${errores.tarjeta_profesional ? ' campo--error' : ''}`}
        >
          <label htmlFor="tarjeta_profesional">Tarjeta profesional *</label>
          <input
            id="tarjeta_profesional"
            value={valores.tarjeta_profesional}
            onChange={(e) =>
              actualizarCampo('tarjeta_profesional', e.target.value)
            }
          />
          {errores.tarjeta_profesional && (
            <span className="campo__error">{errores.tarjeta_profesional}</span>
          )}
        </div>

        <div className={`campo${errores.especialidad ? ' campo--error' : ''}`}>
          <label htmlFor="especialidad">Especialidad *</label>
          <input
            id="especialidad"
            value={valores.especialidad}
            onChange={(e) => actualizarCampo('especialidad', e.target.value)}
          />
          {errores.especialidad && (
            <span className="campo__error">{errores.especialidad}</span>
          )}
        </div>

        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            value={valores.telefono}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />
        </div>

        <div className="formulario__acciones">
          <Link to="/veterinarios" className="boton boton--claro">
            Cancelar
          </Link>
          <button
            type="submit"
            className="boton boton--oscuro"
            disabled={guardando}
          >
            {guardando
              ? 'Guardando…'
              : editando
                ? 'Guardar cambios'
                : 'Registrar veterinario'}
          </button>
        </div>
      </form>

      {editando && (
        <div className="tarjeta seccion" style={{ marginTop: 24 }}>
          <h2 className="seccion__titulo">Días y horas de atención</h2>
          <Alerta tipo="exito">{mensajeHorario}</Alerta>
          <Alerta tipo="error">{errorHorario}</Alerta>

          {horarios.length === 0 ? (
            <p className="texto-sec">Aún no hay horarios registrados.</p>
          ) : (
            <ul className="lista-horarios">
              {horarios.map((h) => (
                <li key={h.id_horario} className="lista-horarios__item">
                  <span>
                    {DIAS[h.dia_semana] ?? h.dia_semana}:{' '}
                    {h.hora_inicio.slice(0, 5)} – {h.hora_fin.slice(0, 5)}
                  </span>
                  <button
                    type="button"
                    className="boton--icono"
                    onClick={() => eliminarHorario(h.id_horario)}
                    aria-label="Eliminar horario"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="formulario-horario" onSubmit={agregarHorario}>
            <select
              value={nuevoHorario.dia_semana}
              onChange={(e) =>
                setNuevoHorario((h) => ({ ...h, dia_semana: e.target.value }))
              }
              aria-label="Día de la semana"
            >
              {Object.entries(DIAS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={nuevoHorario.hora_inicio}
              onChange={(e) =>
                setNuevoHorario((h) => ({ ...h, hora_inicio: e.target.value }))
              }
              aria-label="Hora de inicio"
            />
            <input
              type="time"
              value={nuevoHorario.hora_fin}
              onChange={(e) =>
                setNuevoHorario((h) => ({ ...h, hora_fin: e.target.value }))
              }
              aria-label="Hora de fin"
            />
            <button type="submit" className="boton boton--claro boton--peq">
              <Plus size={14} />
              Agregar
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

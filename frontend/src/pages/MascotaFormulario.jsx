import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import SelectorFoto from '../components/SelectorFoto.jsx';
import BotonVolver from '../components/BotonVolver.jsx';

const VALORES_INICIALES = {
  id_propietario: '',
  nombre: '',
  especie: '',
  raza: '',
  sexo: 'desconocido',
  fecha_nacimiento: '',
  color: '',
  peso_kg: '',
  esterilizado: false,
  microchip: '',
  observaciones: '',
  foto: '',
};

export default function MascotaFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const rol = rolActual();
  const esPersonalClinica = rol === 'veterinario' || rol === 'administrador';

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');

  // El personal de la clínica elige a nombre de qué propietario se registra la mascota
  useEffect(() => {
    if (!esPersonalClinica) return;
    api
      .get('/propietarios?limite=100')
      .then((r) => setPropietarios(Array.isArray(r) ? r : (r?.datos ?? [])))
      .catch(() => {});
  }, [esPersonalClinica]);

  useEffect(() => {
    if (!editando) return;
    api
      .get(`/mascotas/${id}`)
      .then((mascota) =>
        setValores({
          id_propietario: mascota.id_propietario ?? '',
          nombre: mascota.nombre ?? '',
          especie: mascota.especie ?? '',
          raza: mascota.raza ?? '',
          sexo: mascota.sexo ?? 'desconocido',
          fecha_nacimiento: mascota.fecha_nacimiento
            ? mascota.fecha_nacimiento.slice(0, 10)
            : '',
          color: mascota.color ?? '',
          peso_kg: mascota.peso_kg ?? '',
          esterilizado: Boolean(mascota.esterilizado),
          microchip: mascota.microchip ?? '',
          observaciones: mascota.observaciones ?? '',
          foto: mascota.foto ?? '',
        })
      )
      .catch((err) =>
        setErrorGeneral(err.message || 'No se pudo cargar la mascota')
      )
      .finally(() => setCargando(false));
  }, [editando, id]);

  function actualizarCampo(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function validar() {
    const nuevosErrores = {};
    if (!valores.nombre.trim())
      nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!valores.especie.trim())
      nuevosErrores.especie = 'La especie es obligatoria';
    if (esPersonalClinica && !editando && !valores.id_propietario) {
      nuevosErrores.id_propietario = 'Selecciona un propietario';
    }
    if (
      valores.fecha_nacimiento &&
      new Date(valores.fecha_nacimiento) > new Date()
    ) {
      nuevosErrores.fecha_nacimiento = 'No puede ser una fecha futura';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function enviar(e) {
    e.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;

    const cuerpo = {
      nombre: valores.nombre.trim(),
      especie: valores.especie.trim(),
      raza: valores.raza.trim() || undefined,
      sexo: valores.sexo,
      fecha_nacimiento: valores.fecha_nacimiento || undefined,
      color: valores.color.trim() || undefined,
      peso_kg: valores.peso_kg ? Number(valores.peso_kg) : undefined,
      esterilizado: valores.esterilizado,
      microchip: valores.microchip.trim() || undefined,
      observaciones: valores.observaciones.trim() || undefined,
      // Al editar, sin foto = quitarla (null); al registrar, simplemente no se envía
      foto: valores.foto || (editando ? null : undefined),
    };
    if (esPersonalClinica && !editando)
      cuerpo.id_propietario = Number(valores.id_propietario);

    setGuardando(true);
    try {
      if (editando) {
        await api.put(`/mascotas/${id}`, cuerpo);
        navegar('/mascotas', {
          state: { mensaje: 'Mascota actualizada correctamente.' },
        });
      } else {
        await api.post('/mascotas', cuerpo);
        navegar('/mascotas', {
          state: { mensaje: 'Mascota registrada correctamente.' },
        });
      }
    } catch (err) {
      setErrorGeneral(err.message || 'No se pudo guardar la mascota');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <CargandoInline texto="Cargando datos de la mascota…" />;

  return (
    <section>
      <BotonVolver a="/mascotas" texto="Volver" />
      <h1 className="saludo__titulo">
        {editando ? 'Editar mascota' : 'Registrar mascota'}
      </h1>
      <Alerta tipo="error">{errorGeneral}</Alerta>

      <form className="formulario tarjeta" onSubmit={enviar} noValidate>
        {esPersonalClinica && !editando && (
          <div
            className={`campo${errores.id_propietario ? ' campo--error' : ''}`}
          >
            <label htmlFor="id_propietario">Propietario *</label>
            <select
              id="id_propietario"
              value={valores.id_propietario}
              onChange={(e) =>
                actualizarCampo('id_propietario', e.target.value)
              }
            >
              <option value="">Selecciona un propietario…</option>
              {propietarios.map((p) => (
                <option key={p.id_propietario} value={p.id_propietario}>
                  {p.nombre} {p.apellido}
                </option>
              ))}
            </select>
            {errores.id_propietario && (
              <span className="campo__error">{errores.id_propietario}</span>
            )}
          </div>
        )}

        <SelectorFoto
          foto={valores.foto}
          nombre={valores.nombre || 'la mascota'}
          onCambio={(foto) => actualizarCampo('foto', foto)}
        />

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

        <div className={`campo${errores.especie ? ' campo--error' : ''}`}>
          <label htmlFor="especie">Especie *</label>
          <input
            id="especie"
            placeholder="Perro, gato, ave…"
            value={valores.especie}
            onChange={(e) => actualizarCampo('especie', e.target.value)}
          />
          {errores.especie && (
            <span className="campo__error">{errores.especie}</span>
          )}
        </div>

        <div className="campo">
          <label htmlFor="raza">Raza</label>
          <input
            id="raza"
            value={valores.raza}
            onChange={(e) => actualizarCampo('raza', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="sexo">Sexo</label>
          <select
            id="sexo"
            value={valores.sexo}
            onChange={(e) => actualizarCampo('sexo', e.target.value)}
          >
            <option value="desconocido">No especificado</option>
            <option value="macho">Macho</option>
            <option value="hembra">Hembra</option>
          </select>
        </div>

        <div
          className={`campo${errores.fecha_nacimiento ? ' campo--error' : ''}`}
        >
          <label htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
          <input
            id="fecha_nacimiento"
            type="date"
            value={valores.fecha_nacimiento}
            onChange={(e) =>
              actualizarCampo('fecha_nacimiento', e.target.value)
            }
          />
          {errores.fecha_nacimiento && (
            <span className="campo__error">{errores.fecha_nacimiento}</span>
          )}
        </div>

        <div className="campo">
          <label htmlFor="color">Color</label>
          <input
            id="color"
            value={valores.color}
            onChange={(e) => actualizarCampo('color', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="peso_kg">Peso (kg)</label>
          <input
            id="peso_kg"
            type="number"
            min="0"
            step="0.1"
            value={valores.peso_kg}
            onChange={(e) => actualizarCampo('peso_kg', e.target.value)}
          />
        </div>

        <div className="campo campo--checkbox">
          <input
            id="esterilizado"
            type="checkbox"
            checked={valores.esterilizado}
            onChange={(e) => actualizarCampo('esterilizado', e.target.checked)}
          />
          <label htmlFor="esterilizado">Esterilizado/a</label>
        </div>

        <div className="campo">
          <label htmlFor="microchip">Microchip</label>
          <input
            id="microchip"
            value={valores.microchip}
            onChange={(e) => actualizarCampo('microchip', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            rows={3}
            value={valores.observaciones}
            onChange={(e) => actualizarCampo('observaciones', e.target.value)}
          />
        </div>

        <div className="formulario__acciones">
          <Link to="/mascotas" className="boton boton--claro">
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
                : 'Registrar mascota'}
          </button>
        </div>
      </form>
    </section>
  );
}
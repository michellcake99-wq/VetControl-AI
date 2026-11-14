import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';

const TIPOS_DOCUMENTO = ['CC', 'CE', 'TI', 'PA', 'NIT'];

const VALORES_INICIALES = {
  nombre: '',
  apellido: '',
  correo: '',
  contrasena: '',
  tipo_documento: 'CC',
  numero_documento: '',
  telefono: '',
  direccion: '',
};

export default function PropietarioFormulario() {
  const navegar = useNavigate();
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);

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
    if (valores.contrasena.length < 8)
      nuevosErrores.contrasena = 'Mínimo 8 caracteres';
    if (!valores.numero_documento.trim())
      nuevosErrores.numero_documento = 'El documento es obligatorio';
    if (!valores.telefono.trim())
      nuevosErrores.telefono = 'El teléfono es obligatorio';
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function enviar(e) {
    e.preventDefault();
    setErrorGeneral('');
    if (!validar()) return;
    setGuardando(true);
    try {
      await api.post('/propietarios', valores);
      navegar('/propietarios', {
        state: { mensaje: 'Propietario registrado correctamente.' },
      });
    } catch (err) {
      setErrorGeneral(err.message || 'No se pudo registrar el propietario');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section>
      <h1 className="saludo__titulo">Registrar propietario</h1>
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
          />
          {errores.correo && (
            <span className="campo__error">{errores.correo}</span>
          )}
        </div>

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

        <div className="campo">
          <label htmlFor="tipo_documento">Tipo de documento</label>
          <select
            id="tipo_documento"
            value={valores.tipo_documento}
            onChange={(e) => actualizarCampo('tipo_documento', e.target.value)}
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div
          className={`campo${errores.numero_documento ? ' campo--error' : ''}`}
        >
          <label htmlFor="numero_documento">Número de documento *</label>
          <input
            id="numero_documento"
            value={valores.numero_documento}
            onChange={(e) =>
              actualizarCampo('numero_documento', e.target.value)
            }
          />
          {errores.numero_documento && (
            <span className="campo__error">{errores.numero_documento}</span>
          )}
        </div>

        <div className={`campo${errores.telefono ? ' campo--error' : ''}`}>
          <label htmlFor="telefono">Teléfono *</label>
          <input
            id="telefono"
            value={valores.telefono}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />
          {errores.telefono && (
            <span className="campo__error">{errores.telefono}</span>
          )}
        </div>

        <div className="campo">
          <label htmlFor="direccion">Dirección</label>
          <input
            id="direccion"
            value={valores.direccion}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
          />
        </div>

        <div className="formulario__acciones">
          <Link to="/propietarios" className="boton boton--claro">
            Cancelar
          </Link>
          <button
            type="submit"
            className="boton boton--oscuro"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Registrar propietario'}
          </button>
        </div>
      </form>
    </section>
  );
}

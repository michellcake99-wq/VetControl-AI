import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api.js';
import Alerta from '../components/Alerta.jsx';

const TIPOS_DOCUMENTO = [
  ['CC', 'Cédula de ciudadanía'],
  ['CE', 'Cédula de extranjería'],
  ['TI', 'Tarjeta de identidad'],
  ['PA', 'Pasaporte'],
  ['NIT', 'NIT'],
];

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

/** Ep3-Hu11: registro de un propietario por parte del personal de la clínica. */
export default function PropietarioFormulario() {
  const navegar = useNavigate();
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verContrasena, setVerContrasena] = useState(false);

  function actualizarCampo(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
    // Al corregir un campo se quita su mensaje de error
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
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
        state: {
          mensaje: `${valores.nombre.trim()} ${valores.apellido.trim()} quedó registrado/a como propietario/a.`,
        },
      });
    } catch (err) {
      // Errores de validación del servidor junto a cada campo
      const delServidor = {};
      for (const d of err.detalles ?? []) {
        delServidor[d.campo.split('.')[0]] ??= d.mensaje;
      }
      setErrores(delServidor);
      if (!Object.keys(delServidor).length)
        setErrorGeneral(err.message || 'No se pudo registrar el propietario');
    } finally {
      setGuardando(false);
    }
  }

  /** Campo de texto con su etiqueta y su mensaje de error. */
  function Campo({ id, etiqueta, tipo = 'text', ayuda, ...resto }) {
    return (
      <div className={`campo${errores[id] ? ' campo--error' : ''}`}>
        <label htmlFor={id}>{etiqueta}</label>
        <input
          id={id}
          type={tipo}
          value={valores[id]}
          onChange={(e) => actualizarCampo(id, e.target.value)}
          aria-invalid={Boolean(errores[id])}
          {...resto}
        />
        {errores[id] ? (
          <span className="campo__error" role="alert">
            {errores[id]}
          </span>
        ) : (
          ayuda && <span className="campo__ayuda">{ayuda}</span>
        )}
      </div>
    );
  }

  return (
    <section>
      <Link to="/propietarios" className="historia__volver">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a propietarios
      </Link>

      <h1 className="saludo__titulo">Registrar propietario</h1>
      <p className="texto-sec">
        Crea la cuenta del dueño de la mascota. Con el correo y la contraseña
        temporal podrá entrar a VetControl AI.
      </p>
      <Alerta tipo="error">{errorGeneral}</Alerta>

      <form
        className="formulario formulario--medio tarjeta"
        onSubmit={enviar}
        noValidate
      >
        <h2 className="formulario__seccion">Datos personales</h2>
        <div className="campos-grid">
          {Campo({ id: 'nombre', etiqueta: 'Nombre *', autoComplete: 'off' })}
          {Campo({
            id: 'apellido',
            etiqueta: 'Apellido *',
            autoComplete: 'off',
          })}
          <div className="campo">
            <label htmlFor="tipo_documento">Tipo de documento</label>
            <select
              id="tipo_documento"
              value={valores.tipo_documento}
              onChange={(e) =>
                actualizarCampo('tipo_documento', e.target.value)
              }
            >
              {TIPOS_DOCUMENTO.map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {valor} · {etiqueta}
                </option>
              ))}
            </select>
          </div>
          {Campo({
            id: 'numero_documento',
            etiqueta: 'Número de documento *',
            inputMode: 'numeric',
          })}
        </div>

        <h2 className="formulario__seccion">Contacto</h2>
        <div className="campos-grid">
          {Campo({
            id: 'telefono',
            etiqueta: 'Teléfono *',
            tipo: 'tel',
            placeholder: 'Ej.: 3001234567',
          })}
          {Campo({
            id: 'direccion',
            etiqueta: 'Dirección',
            placeholder: 'Opcional',
          })}
        </div>

        <h2 className="formulario__seccion">Acceso a VetControl AI</h2>
        <div className="campos-grid">
          {Campo({
            id: 'correo',
            etiqueta: 'Correo *',
            tipo: 'email',
            placeholder: 'nombre@correo.com',
            autoComplete: 'off',
          })}
          <div className={`campo${errores.contrasena ? ' campo--error' : ''}`}>
            <label htmlFor="contrasena">Contraseña temporal *</label>
            <div className="campo-contrasena">
              <input
                id="contrasena"
                type={verContrasena ? 'text' : 'password'}
                value={valores.contrasena}
                onChange={(e) => actualizarCampo('contrasena', e.target.value)}
                aria-invalid={Boolean(errores.contrasena)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="campo-contrasena__ver"
                onClick={() => setVerContrasena((v) => !v)}
                aria-label={
                  verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                {verContrasena ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errores.contrasena ? (
              <span className="campo__error" role="alert">
                {errores.contrasena}
              </span>
            ) : (
              <span className="campo__ayuda">
                Mínimo 8 caracteres. Compártela con el propietario.
              </span>
            )}
          </div>
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
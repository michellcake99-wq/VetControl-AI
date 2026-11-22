import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoTexto from '../components/CampoTexto.jsx';
import { solicitarRecuperacion } from '../services/api.js';
import { validarCampo } from '../utils/validaciones.js';

/**
 * Ep7-Hu4: el usuario escribe su correo y recibe un enlace (vale 1 hora, un solo uso).
 * La respuesta es la misma exista o no el correo, para no revelar quién tiene cuenta.
 */
export default function RecuperarContrasena() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setErrorApi('');
    const problema = validarCampo('correo', correo);
    setError(problema);
    if (problema) return;

    setCargando(true);
    try {
      const r = await solicitarRecuperacion(correo.trim().toLowerCase());
      setMensaje(r.mensaje);
    } catch (err) {
      setErrorApi(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Recuperar contraseña"
      subtitulo="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva."
      pie={
        <>
          ¿Ya la recordaste? <Link to="/iniciar-sesion">Inicia sesión</Link>
        </>
      }
    >
      {mensaje ? (
        <>
          <p className="aviso aviso--exito" role="status">
            <CircleCheck size={18} aria-hidden="true" />
            {mensaje}
          </p>
          <Link
            to="/iniciar-sesion"
            className="boton boton--oscuro auth__enviar"
          >
            Volver a iniciar sesión
          </Link>
        </>
      ) : (
        <>
          {errorApi && (
            <p className="aviso aviso--error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              {errorApi}
            </p>
          )}
          <form className="auth__formulario" onSubmit={enviar} noValidate>
            <CampoTexto
              id="correo"
              etiqueta="Correo electrónico"
              tipo="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value);
                setError('');
              }}
              error={error}
            />
            <button
              type="submit"
              className="boton boton--oscuro auth__enviar"
              disabled={cargando}
            >
              {cargando ? (
                <>
                  <LoaderCircle
                    className="girar"
                    size={18}
                    aria-hidden="true"
                  />{' '}
                  Enviando…
                </>
              ) : (
                'Enviar enlace'
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

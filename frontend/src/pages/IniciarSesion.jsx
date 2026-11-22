import { useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoTexto from '../components/CampoTexto.jsx';
import { ErrorApi, iniciarSesion } from '../services/api.js';
import { guardarSesion, obtenerSesion, rutaPorRol } from '../utils/sesion.js';
import { validarCampo } from '../utils/validaciones.js';

export default function IniciarSesion() {
  const navegar = useNavigate();
  const { state } = useLocation();
  const [parametros] = useSearchParams();
  // Ep7-Hu3: la sesión terminó porque el token venció
  const expirada = Boolean(state?.expirada) || parametros.has('expirada');
  const formulario = useRef(null);
  const [datos, setDatos] = useState({
    correo: state?.correo ?? '',
    contrasena: '',
  });
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(false);

  const sesion = obtenerSesion();
  if (sesion) return <Navigate to={rutaPorRol(sesion.usuario.rol)} replace />;

  const cambiar = (e) => {
    const { name, value } = e.target;
    setDatos((d) => ({ ...d, [name]: value }));
    if (errores[name]) setErrores((er) => ({ ...er, [name]: '' }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErrorApi('');
    const nuevos = {
      correo: validarCampo('correo', datos.correo),
      contrasena: validarCampo('contrasena', datos.contrasena),
    };
    setErrores(nuevos);
    const primerError = Object.keys(nuevos).find((c) => nuevos[c]);
    if (primerError) {
      formulario.current.elements[primerError].focus();
      return;
    }

    setCargando(true);
    try {
      const { token, usuario } = await iniciarSesion(
        datos.correo.trim().toLowerCase(),
        datos.contrasena
      );
      guardarSesion({ token, usuario });
      // Vuelve a la página que el usuario quería ver; si no hay, va a su dashboard
      navegar(state?.desde ?? rutaPorRol(usuario.rol), { replace: true });
    } catch (error) {
      setErrorApi(
        error instanceof ErrorApi
          ? error.message
          : 'Ocurrió un error inesperado.'
      );
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Iniciar sesión"
      subtitulo="Ingresa con tu correo para ver a tus mascotas y tus citas."
      pie={
        <>
          ¿Aún no tienes cuenta? <Link to="/registro">Regístrate</Link>
        </>
      }
    >
      {state?.registrado && (
        <p className="aviso aviso--exito" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          Tu cuenta se creó correctamente. Ya puedes iniciar sesión.
        </p>
      )}
      {expirada && (
        <p className="aviso aviso--info" role="status">
          Tu sesión expiró. Inicia sesión de nuevo para continuar.
        </p>
      )}
      {state?.desde && !state?.registrado && !expirada && (
        <p className="aviso aviso--info" role="status">
          Inicia sesión para continuar.
        </p>
      )}
      {errorApi && (
        <p className="aviso aviso--error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          {errorApi}
        </p>
      )}

      <form
        ref={formulario}
        className="auth__formulario"
        onSubmit={enviar}
        noValidate
      >
        <CampoTexto
          id="correo"
          etiqueta="Correo electrónico"
          tipo="email"
          autoComplete="email"
          placeholder="nombre@correo.com"
          value={datos.correo}
          onChange={cambiar}
          error={errores.correo}
        />
        <CampoTexto
          id="contrasena"
          etiqueta="Contraseña"
          tipo="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={datos.contrasena}
          onChange={cambiar}
          error={errores.contrasena}
        />
        <Link to="/recuperar-contrasena" className="auth__olvido">
          ¿Olvidó su contraseña?
        </Link>
        <button
          type="submit"
          className="boton boton--oscuro auth__enviar"
          disabled={cargando}
        >
          {cargando ? (
            <>
              <LoaderCircle className="girar" size={18} aria-hidden="true" />{' '}
              Ingresando…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
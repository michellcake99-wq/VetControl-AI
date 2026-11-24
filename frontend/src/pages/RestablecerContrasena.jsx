import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, LoaderCircle, Lock } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoTexto from '../components/CampoTexto.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import {
  restablecerContrasena,
  verificarTokenRecuperacion,
} from '../services/api.js';
import { validarCampo } from '../utils/validaciones.js';

const TOKEN_VALIDO = /^[a-f0-9]{64}$/;

/**
 * Ep7-Hu4: pantalla a la que llega el enlace del correo (/restablecer-contrasena?token=...).
 * Revisa el enlace al abrir; si ya se usó o venció, lo dice y ofrece pedir uno nuevo.
 */
export default function RestablecerContrasena() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const navegar = useNavigate();

  // 'revisando' | 'valido' | 'invalido'
  const [estado, setEstado] = useState(
    TOKEN_VALIDO.test(token) ? 'revisando' : 'invalido'
  );
  const [datos, setDatos] = useState({ contrasena: '', confirmacion: '' });
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!TOKEN_VALIDO.test(token)) return undefined;
    let activo = true;
    verificarTokenRecuperacion(token)
      .then(() => activo && setEstado('valido'))
      .catch(() => activo && setEstado('invalido'));
    return () => {
      activo = false;
    };
  }, [token]);

  const cambiar = (e) => {
    const { name, value } = e.target;
    setDatos((d) => ({ ...d, [name]: value }));
    setErrores((er) => ({ ...er, [name]: '' }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErrorApi('');
    const nuevos = {
      contrasena: validarCampo('contrasenaNueva', datos.contrasena),
      confirmacion:
        datos.confirmacion !== datos.contrasena
          ? 'Las contraseñas no coinciden'
          : '',
    };
    setErrores(nuevos);
    if (nuevos.contrasena || nuevos.confirmacion) return;

    setCargando(true);
    try {
      await restablecerContrasena(token, datos.contrasena, datos.confirmacion);
      navegar('/iniciar-sesion', {
        replace: true,
        state: { contrasenaCambiada: true },
      });
    } catch (err) {
      if (err.estado === 400 && !err.detalles?.length) setEstado('invalido');
      else setErrorApi(err.message || 'Ocurrió un error inesperado.');
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Crear contraseña nueva"
      subtitulo="Elige una contraseña de al menos 8 caracteres."
    >
      {estado === 'revisando' && (
        <CargandoInline texto="Revisando el enlace…" />
      )}

      {estado === 'invalido' && (
        <>
          <p className="aviso aviso--error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            El enlace no es válido o ya venció. Solicita uno nuevo.
          </p>
          <Link
            to="/recuperar-contrasena"
            className="boton boton--oscuro auth__enviar"
          >
            Solicitar un enlace nuevo
          </Link>
        </>
      )}

      {estado === 'valido' && (
        <>
          {errorApi && (
            <p className="aviso aviso--error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              {errorApi}
            </p>
          )}
          <form className="auth__formulario" onSubmit={enviar} noValidate>
            <CampoTexto
              id="contrasena"
              etiqueta="Contraseña nueva"
              icono={Lock}
              tipo="password"
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres."
              value={datos.contrasena}
              onChange={cambiar}
              error={errores.contrasena}
            />
            <CampoTexto
              id="confirmacion"
              etiqueta="Confirmar contraseña"
              icono={Lock}
              tipo="password"
              autoComplete="new-password"
              value={datos.confirmacion}
              onChange={cambiar}
              error={errores.confirmacion}
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
                  Guardando…
                </>
              ) : (
                'Guardar contraseña'
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
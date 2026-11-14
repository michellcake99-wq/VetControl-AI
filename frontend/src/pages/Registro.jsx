import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CircleAlert, LoaderCircle, PawPrint, Stethoscope } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import CampoTexto from '../components/CampoTexto.jsx';
import { ErrorApi, registrarUsuario } from '../services/api.js';
import { obtenerSesion, rutaPorRol } from '../utils/sesion.js';
import { validarCampo } from '../utils/validaciones.js';

const roles = [
  {
    valor: 'propietario',
    etiqueta: 'Propietario',
    detalle: 'Tengo una mascota',
    icon: PawPrint,
  },
  {
    valor: 'veterinario',
    etiqueta: 'Veterinario',
    detalle: 'Atiendo pacientes',
    icon: Stethoscope,
  },
];

const vacio = {
  nombre: '',
  apellido: '',
  correo: '',
  contrasena: '',
  rol: 'propietario',
};

export default function Registro() {
  const navegar = useNavigate();
  const formulario = useRef(null);
  const [datos, setDatos] = useState(vacio);
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
      nombre: validarCampo('nombre', datos.nombre),
      apellido: validarCampo('apellido', datos.apellido),
      correo: validarCampo('correo', datos.correo),
      contrasena: validarCampo('contrasenaNueva', datos.contrasena),
    };
    setErrores(nuevos);
    const primerError = Object.keys(nuevos).find((c) => nuevos[c]);
    if (primerError) {
      formulario.current.elements[primerError].focus();
      return;
    }

    setCargando(true);
    const correo = datos.correo.trim().toLowerCase();
    try {
      await registrarUsuario({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        correo,
        contrasena: datos.contrasena,
        rol: datos.rol,
      });
      navegar('/iniciar-sesion', {
        replace: true,
        state: { registrado: true, correo },
      });
    } catch (error) {
      const mensaje =
        error instanceof ErrorApi
          ? error.message
          : 'Ocurrió un error inesperado.';
      if (error instanceof ErrorApi && error.estado === 409) {
        // correo ya registrado: se marca el campo para que el usuario lo corrija
        setErrores({ correo: mensaje });
        formulario.current.elements.correo.focus();
      } else {
        setErrorApi(mensaje);
      }
      setCargando(false);
    }
  };

  return (
    <AuthLayout
      titulo="Crear cuenta"
      subtitulo="Regístrate para gestionar la salud de tus mascotas en un solo lugar."
      pie={
        <>
          ¿Ya tienes cuenta? <Link to="/iniciar-sesion">Inicia sesión</Link>
        </>
      }
    >
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
        <div className="auth__fila">
          <CampoTexto
            id="nombre"
            etiqueta="Nombre"
            autoComplete="given-name"
            value={datos.nombre}
            onChange={cambiar}
            error={errores.nombre}
          />
          <CampoTexto
            id="apellido"
            etiqueta="Apellido"
            autoComplete="family-name"
            value={datos.apellido}
            onChange={cambiar}
            error={errores.apellido}
          />
        </div>
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
          autoComplete="new-password"
          ayuda="Mínimo 8 caracteres."
          value={datos.contrasena}
          onChange={cambiar}
          error={errores.contrasena}
        />

        <fieldset className="roles">
          <legend className="campo__etiqueta">Soy</legend>
          <div className="roles__opciones">
            {roles.map(({ valor, etiqueta, detalle, icon: Icon }) => (
              <label key={valor} className="rol">
                <input
                  type="radio"
                  name="rol"
                  value={valor}
                  checked={datos.rol === valor}
                  onChange={cambiar}
                />
                <span className="rol__tarjeta">
                  <span
                    className="icono-circulo icono-circulo--36"
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="rol__titulo">{etiqueta}</span>
                    <span className="rol__detalle">{detalle}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="boton boton--oscuro auth__enviar"
          disabled={cargando}
        >
          {cargando ? (
            <>
              <LoaderCircle className="girar" size={18} aria-hidden="true" />{' '}
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { actualizarUsuarioSesion } from '../utils/sesion.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';

const TIPOS_DOCUMENTO = [
  ['CC', 'Cédula de ciudadanía'],
  ['CE', 'Cédula de extranjería'],
  ['TI', 'Tarjeta de identidad'],
  ['PA', 'Pasaporte'],
  ['NIT', 'NIT'],
];
const ROLES = {
  propietario: 'Propietario/a',
  veterinario: 'Veterinario/a',
  administrador: 'Administrador/a',
};
const TELEFONO = /^\+?[0-9 ]{7,20}$/;

// Campos editables según el rol (el correo y el rol nunca se editan)
const CAMPOS = {
  propietario: [
    'nombre',
    'apellido',
    'telefono',
    'direccion',
    'tipo_documento',
    'numero_documento',
  ],
  veterinario: [
    'nombre',
    'apellido',
    'telefono',
    'especialidad',
    'tarjeta_profesional',
  ],
  administrador: ['nombre', 'apellido'],
};

const aFormulario = (perfil) =>
  Object.fromEntries(CAMPOS[perfil.rol].map((c) => [c, perfil[c] ?? '']));

function validar(v, rol) {
  const e = {};
  if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  if (!v.apellido.trim()) e.apellido = 'El apellido es obligatorio.';
  const tel = v.telefono?.trim();
  if (tel && !TELEFONO.test(tel))
    e.telefono = 'Escribe un teléfono válido (7 a 20 dígitos).';
  // El propietario debe tener un teléfono de contacto; en el veterinario es opcional
  if (rol === 'propietario' && !tel) e.telefono = 'El teléfono es obligatorio.';
  if (rol === 'veterinario' && !v.especialidad.trim())
    e.especialidad = 'La especialidad es obligatoria.';
  return e;
}

/** Campo con etiqueta y mensaje de error (o dato de solo lectura). */
function Campo({
  id,
  etiqueta,
  valor,
  onCambio,
  error,
  ayuda,
  soloLectura,
  tipo = 'text',
  ...resto
}) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => onCambio?.(id, e.target.value)}
        readOnly={soloLectura}
        aria-invalid={Boolean(error)}
        className={soloLectura ? 'campo__solo-lectura' : undefined}
        {...resto}
      />
      {error ? (
        <span className="campo__error" role="alert">
          {error}
        </span>
      ) : (
        ayuda && <span className="campo__ayuda">{ayuda}</span>
      )}
    </div>
  );
}

/**
 * Ep4-Hu4: «Mi perfil». Cada usuario ve y edita sus datos (no el correo ni el rol)
 * y puede cambiar su contraseña escribiendo primero la actual.
 */
export default function MiPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [valores, setValores] = useState({});
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [errorGuardar, setErrorGuardar] = useState('');

  const vacioClave = { actual: '', nueva: '', confirmacion: '' };
  const [clave, setClave] = useState(vacioClave);
  const [erroresClave, setErroresClave] = useState({});
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [mensajeClave, setMensajeClave] = useState('');
  const [errorClave, setErrorClave] = useState('');

  useEffect(() => {
    let activo = true;
    api
      .get('/perfil')
      .then((p) => {
        if (!activo) return;
        setPerfil(p);
        setValores(aFormulario(p));
      })
      .catch((err) => {
        if (activo)
          setErrorCarga(err.message || 'No se pudo cargar tu perfil.');
      });
    return () => {
      activo = false;
    };
  }, []);

  if (errorCarga) return <Alerta tipo="error">{errorCarga}</Alerta>;
  if (!perfil) return <CargandoInline texto="Cargando tu perfil…" />;

  const rol = perfil.rol;
  const cambiar = (campo, valor) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
    setMensaje('');
  };
  // El documento y la tarjeta profesional se completan una vez; después los cambia el personal
  const documentoFijo =
    rol === 'propietario' && Boolean(perfil.numero_documento);
  const tarjetaFija =
    rol === 'veterinario' && Boolean(perfil.tarjeta_profesional);

  async function guardar(evento) {
    evento.preventDefault();
    setMensaje('');
    setErrorGuardar('');
    const encontrados = validar(valores, rol);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    const cuerpo = {};
    for (const campo of CAMPOS[rol]) {
      if (
        (campo === 'tipo_documento' || campo === 'numero_documento') &&
        documentoFijo
      )
        continue;
      if (campo === 'tarjeta_profesional' && tarjetaFija) continue;
      const texto = String(valores[campo]).trim();
      if (
        texto === '' &&
        (campo === 'numero_documento' || campo === 'tarjeta_profesional')
      )
        continue;
      if (texto === '' && campo === 'telefono') continue;
      cuerpo[campo] = texto === '' && campo === 'direccion' ? null : texto;
    }

    setGuardando(true);
    try {
      const nuevo = await api.put('/perfil', cuerpo);
      setPerfil(nuevo);
      setValores(aFormulario(nuevo));
      actualizarUsuarioSesion({
        nombre: nuevo.nombre,
        apellido: nuevo.apellido,
      });
      setMensaje('Tus datos se guardaron correctamente.');
    } catch (err) {
      setErrores(
        Object.fromEntries(
          (err.detalles ?? []).map((d) => [d.campo, d.mensaje])
        )
      );
      setErrorGuardar(
        err.estado === 409
          ? 'Ese documento o tarjeta profesional ya está registrado por otra persona.'
          : err.message || 'No se pudieron guardar los cambios.'
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarClave(evento) {
    evento.preventDefault();
    setMensajeClave('');
    setErrorClave('');
    const e = {};
    if (!clave.actual) e.contrasena_actual = 'Escribe tu contraseña actual.';
    if (clave.nueva.length < 8)
      e.contrasena_nueva = 'La contraseña debe tener mínimo 8 caracteres.';
    else if (clave.nueva === clave.actual)
      e.contrasena_nueva =
        'La contraseña nueva debe ser distinta de la actual.';
    if (clave.confirmacion !== clave.nueva)
      e.confirmacion = 'Las contraseñas no coinciden.';
    setErroresClave(e);
    if (Object.keys(e).length) return;

    setCambiandoClave(true);
    try {
      await api.put('/perfil/contrasena', {
        contrasena_actual: clave.actual,
        contrasena_nueva: clave.nueva,
        confirmacion: clave.confirmacion,
      });
      setClave(vacioClave);
      setMensajeClave('Tu contraseña se actualizó correctamente.');
    } catch (err) {
      setErroresClave(
        Object.fromEntries(
          (err.detalles ?? []).map((d) => [d.campo, d.mensaje])
        )
      );
      setErrorClave(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setCambiandoClave(false);
    }
  }

  const cambiarCampoClave = (campo, valor) => {
    setClave((c) => ({ ...c, [campo]: valor }));
    setErroresClave((e) => ({ ...e, [campo]: undefined }));
    setMensajeClave('');
  };

  return (
    <section>
      <h1 className="saludo__titulo">Mi perfil</h1>
      <p className="texto-sec">
        {ROLES[rol]} · Revisa y actualiza tus datos. Solo tú puedes ver y editar
        esta información.
      </p>

      <form
        className="formulario formulario--medio tarjeta"
        onSubmit={guardar}
        noValidate
      >
        <h2 className="formulario__seccion">Datos personales</h2>
        <Alerta tipo="exito">{mensaje}</Alerta>
        <Alerta tipo="error">{errorGuardar}</Alerta>
        <div className="campos-grid">
          <Campo
            id="nombre"
            etiqueta="Nombre *"
            valor={valores.nombre}
            onCambio={cambiar}
            error={errores.nombre}
            autoComplete="given-name"
          />
          <Campo
            id="apellido"
            etiqueta="Apellido *"
            valor={valores.apellido}
            onCambio={cambiar}
            error={errores.apellido}
            autoComplete="family-name"
          />
          <Campo
            id="correo"
            etiqueta="Correo electrónico"
            valor={perfil.correo}
            soloLectura
            ayuda="El correo no se puede modificar."
          />
          {rol !== 'administrador' && (
            <Campo
              id="telefono"
              etiqueta={rol === 'propietario' ? 'Teléfono *' : 'Teléfono'}
              valor={valores.telefono}
              onCambio={cambiar}
              error={errores.telefono}
              inputMode="tel"
              autoComplete="tel"
            />
          )}
        </div>

        {rol === 'propietario' && (
          <>
            <h2 className="formulario__seccion">Documento y dirección</h2>
            <div className="campos-grid">
              <div className="campo">
                <label htmlFor="tipo_documento">Tipo de documento</label>
                <select
                  id="tipo_documento"
                  value={valores.tipo_documento}
                  disabled={documentoFijo}
                  onChange={(e) => cambiar('tipo_documento', e.target.value)}
                >
                  {TIPOS_DOCUMENTO.map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {valor} · {etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <Campo
                id="numero_documento"
                etiqueta="Número de documento"
                valor={valores.numero_documento}
                onCambio={cambiar}
                error={errores.numero_documento}
                soloLectura={documentoFijo}
                ayuda={
                  documentoFijo
                    ? 'Si necesitas corregirlo, pídelo en la clínica.'
                    : undefined
                }
              />
              <Campo
                id="direccion"
                etiqueta="Dirección"
                valor={valores.direccion}
                onCambio={cambiar}
                error={errores.direccion}
                autoComplete="street-address"
              />
            </div>
          </>
        )}

        {rol === 'veterinario' && (
          <>
            <h2 className="formulario__seccion">Datos profesionales</h2>
            <div className="campos-grid">
              <Campo
                id="tarjeta_profesional"
                etiqueta="Tarjeta profesional"
                valor={valores.tarjeta_profesional}
                onCambio={cambiar}
                error={errores.tarjeta_profesional}
                soloLectura={tarjetaFija}
                ayuda={
                  tarjetaFija
                    ? 'Solo el administrador puede cambiarla.'
                    : undefined
                }
              />
              <Campo
                id="especialidad"
                etiqueta="Especialidad *"
                valor={valores.especialidad}
                onCambio={cambiar}
                error={errores.especialidad}
              />
            </div>
          </>
        )}

        <div className="formulario__acciones">
          <button
            type="submit"
            className="boton boton--oscuro"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <form
        className="formulario formulario--medio tarjeta"
        onSubmit={cambiarClave}
        noValidate
      >
        <h2 className="formulario__seccion">Cambiar contraseña</h2>
        <Alerta tipo="exito">{mensajeClave}</Alerta>
        <Alerta tipo="error">
          {errorClave && !Object.keys(erroresClave).length ? errorClave : ''}
        </Alerta>
        <div className="campos-grid">
          <Campo
            id="contrasena_actual"
            etiqueta="Contraseña actual *"
            tipo="password"
            valor={clave.actual}
            onCambio={(_, v) => cambiarCampoClave('actual', v)}
            error={erroresClave.contrasena_actual}
            autoComplete="current-password"
          />
          <span />
          <Campo
            id="contrasena_nueva"
            etiqueta="Contraseña nueva *"
            tipo="password"
            valor={clave.nueva}
            onCambio={(_, v) => cambiarCampoClave('nueva', v)}
            error={erroresClave.contrasena_nueva}
            ayuda="Mínimo 8 caracteres."
            autoComplete="new-password"
          />
          <Campo
            id="confirmacion"
            etiqueta="Confirmar contraseña nueva *"
            tipo="password"
            valor={clave.confirmacion}
            onCambio={(_, v) => cambiarCampoClave('confirmacion', v)}
            error={erroresClave.confirmacion}
            autoComplete="new-password"
          />
        </div>
        <div className="formulario__acciones">
          <button
            type="submit"
            className="boton boton--oscuro"
            disabled={cambiandoClave}
          >
            {cambiandoClave ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </section>
  );
}

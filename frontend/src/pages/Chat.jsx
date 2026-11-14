import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Plus, SendHorizontal } from 'lucide-react';
import {
  chatApi,
  conectarChat,
  obtenerToken,
  usuarioDelToken,
} from '../api/chat.js';
import './Chat.css';

// Ep8-Hu1: envío de mensajes entre propietario y veterinario
const MAX_CARACTERES = 1000;

const hora = (iso) =>
  new Intl.DateTimeFormat('es-EC', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));

export default function Chat() {
  const token = obtenerToken();
  const yo = token && usuarioDelToken(token);

  if (!yo) {
    return (
      <section className="vacio">
        <h1 className="saludo__titulo">Mensajes</h1>
        <p className="texto-sec">
          Inicia sesión para chatear con tu veterinario.
        </p>
      </section>
    );
  }
  return <SalaChat token={token} yo={yo} />;
}

function SalaChat({ token, yo }) {
  const [conversaciones, setConversaciones] = useState([]);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [conexion, setConexion] = useState('conectando');
  const [error, setError] = useState('');
  const [nueva, setNueva] = useState(false);

  const socketRef = useRef(null);
  const finRef = useRef(null);

  const cargarConversaciones = useCallback(
    () =>
      chatApi
        .conversaciones()
        .then(setConversaciones)
        .catch((e) => setError(e.message)),
    []
  );

  const abrir = useCallback(async (id) => {
    setActiva(id);
    setError('');
    try {
      setMensajes(await chatApi.mensajes(id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // Conexión con el servidor de chat (valida el token JWT)
  useEffect(() => {
    cargarConversaciones();
    const socket = conectarChat(token);
    socketRef.current = socket;

    socket.on('connect', () => setConexion('conectado'));
    socket.on('disconnect', () => setConexion('conectando'));
    socket.on('connect_error', (e) => {
      if (!socket.active) setError(`${e.message}. Vuelve a iniciar sesión.`); // token inválido o vencido
    });

    return () => socket.disconnect();
  }, [token, cargarConversaciones]);
  // Mantener visible el último mensaje
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes]);

  async function enviar(e) {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido || contenido.length > MAX_CARACTERES) return;
    try {
      const r = await socketRef.current
        .timeout(5000)
        .emitWithAck('enviar_mensaje', { id_conversacion: activa, contenido });
      if (r.error) return setError(r.error);
      setMensajes((ms) => [...ms, r.mensaje]);
      setConversaciones((cs) =>
        cs.map((c) =>
          c.id_conversacion === activa ? { ...c, ultimo_mensaje: r.mensaje } : c
        )
      );
      setTexto('');
      setError('');
    } catch {
      setError('No se pudo enviar el mensaje. Revisa tu conexión.');
    }
  }

  const conversacion = conversaciones.find((c) => c.id_conversacion === activa);
  const largo = texto.trim().length;

  return (
    <div className="chat">
      <header className="chat__cabecera">
        <h1 className="saludo__titulo">Mensajes</h1>
        {conexion !== 'conectado' && (
          <span className="chat__estado" role="status">
            Conectando…
          </span>
        )}
      </header>

      {error && (
        <p className="chat__error" role="alert">
          {error}
        </p>
      )}

      <div
        className={`chat__cuerpo tarjeta${activa ? ' chat__cuerpo--abierta' : ''}`}
      >
        <aside className="chat__lista" aria-label="Conversaciones">
          {yo.rol === 'propietario' && (
            <button
              type="button"
              className="boton boton--oscuro chat__nueva"
              onClick={() => setNueva((v) => !v)}
            >
              <Plus size={16} aria-hidden="true" /> Nueva conversación
            </button>
          )}
          {nueva && (
            <NuevaConversacion
              onCreada={async (c) => {
                setNueva(false);
                await cargarConversaciones();
                abrir(c.id_conversacion);
              }}
              onError={setError}
            />
          )}
          {conversaciones.length === 0 && (
            <p className="texto-sec chat__sin">Aún no tienes conversaciones.</p>
          )}
          <ul>
            {conversaciones.map((c) => (
              <li key={c.id_conversacion}>
                <button
                  type="button"
                  className={`chat__item${c.id_conversacion === activa ? ' chat__item--activo' : ''}`}
                  onClick={() => abrir(c.id_conversacion)}
                >
                  <span className="chat__item-texto">
                    <span className="chat__item-nombre">
                      {c.nombre_contacto}
                    </span>
                    {c.nombre_mascota && (
                      <span className="chat__item-mascota">
                        {c.nombre_mascota}
                      </span>
                    )}
                    <span className="texto-sec chat__item-ultimo">
                      {c.ultimo_mensaje?.contenido ?? 'Sin mensajes'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="chat__panel" aria-label="Conversación">
          {!conversacion ? (
            <div className="chat__placeholder texto-sec">
              <MessageCircle size={32} aria-hidden="true" />
              Elige una conversación para ver los mensajes.
            </div>
          ) : (
            <>
              <div className="chat__panel-cabecera">
                <button
                  type="button"
                  className="chat__volver"
                  onClick={() => setActiva(null)}
                  aria-label="Volver a las conversaciones"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <p className="chat__item-nombre">
                    {conversacion.nombre_contacto}
                  </p>
                  {conversacion.nombre_mascota && (
                    <p className="texto-sec">
                      Sobre {conversacion.nombre_mascota}
                    </p>
                  )}
                </div>
              </div>

              <ol className="chat__mensajes">
                {mensajes.map((m) => {
                  const mio = m.id_remitente === yo.id_usuario;
                  return (
                    <li
                      key={m.id_mensaje}
                      className={`chat__burbuja chat__burbuja--${mio ? 'enviado' : 'recibido'}`}
                    >
                      <span className="sr-only">
                        {mio ? 'Tú:' : `${conversacion.nombre_contacto}:`}
                      </span>
                      <p>{m.contenido}</p>
                      <time dateTime={m.fecha_envio}>
                        {hora(m.fecha_envio)}
                      </time>
                    </li>
                  );
                })}
                <li ref={finRef} aria-hidden="true" />
              </ol>

              <form className="chat__form" onSubmit={enviar}>
                <label htmlFor="chat-texto" className="sr-only">
                  Escribe un mensaje
                </label>
                <textarea
                  id="chat-texto"
                  rows={2}
                  value={texto}
                  maxLength={MAX_CARACTERES}
                  placeholder="Escribe un mensaje…"
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) enviar(e);
                  }}
                />
                <span className="chat__contador texto-sec">
                  {largo}/{MAX_CARACTERES}
                </span>
                <button
                  type="submit"
                  className="boton boton--oscuro chat__enviar"
                  disabled={!largo || conexion !== 'conectado'}
                  aria-label="Enviar mensaje"
                >
                  <SendHorizontal size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function NuevaConversacion({ onCreada, onError }) {
  const [veterinarios, setVeterinarios] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [idVeterinario, setIdVeterinario] = useState('');
  const [idMascota, setIdMascota] = useState('');

  useEffect(() => {
    Promise.all([chatApi.veterinarios(), chatApi.misMascotas()])
      .then(([v, m]) => {
        setVeterinarios(v);
        setMascotas(m);
      })
      .catch((e) => onError(e.message));
  }, [onError]);

  async function crear(e) {
    e.preventDefault();
    try {
      const c = await chatApi.crearConversacion({
        id_veterinario: Number(idVeterinario),
        id_mascota: idMascota ? Number(idMascota) : null,
      });
      onCreada(c);
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <form className="chat__form-nueva" onSubmit={crear}>
      <label>
        Veterinario
        <select
          required
          value={idVeterinario}
          onChange={(e) => setIdVeterinario(e.target.value)}
        >
          <option value="">Elige un veterinario</option>
          {veterinarios.map((v) => (
            <option key={v.id_veterinario} value={v.id_veterinario}>
              {v.nombre} {v.apellido}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mascota (opcional)
        <select
          value={idMascota}
          onChange={(e) => setIdMascota(e.target.value)}
        >
          <option value="">Ninguna en particular</option>
          {mascotas.map((m) => (
            <option key={m.id_mascota} value={m.id_mascota}>
              {m.nombre}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="boton boton--oscuro">
        Iniciar
      </button>
    </form>
  );
}

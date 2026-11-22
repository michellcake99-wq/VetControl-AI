import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Plus, SendHorizontal } from 'lucide-react';
import {
  chatApi,
  conectarChat,
  obtenerToken,
  usuarioDelToken,
} from '../api/chat.js';
import { estadoHorario, textoProximaAtencion } from '../utils/atencion.js';
import EstadoAtencion from '../components/EstadoAtencion.jsx';
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
  // Ep8-Hu4: quién está en línea (llega por el socket) y la hora actual para el horario de atención
  const [presencia, setPresencia] = useState({});
  const [ahora, setAhora] = useState(() => new Date());
  // Avisos de «fuera de horario» que se muestran justo después del mensaje enviado
  const [avisos, setAvisos] = useState({});

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

    socket.on('connect', () => {
      setConexion('conectado');
      // Al (re)conectar se pide todo de nuevo: pudo cambiar algo mientras no había conexión
      setPresencia({});
      cargarConversaciones();
    });
    socket.on('disconnect', () => setConexion('conectando'));
    // Ep8-Hu4: estado del veterinario en tiempo real
    socket.on('estados_veterinarios', (lista) =>
      setPresencia(
        Object.fromEntries(lista.map((e) => [e.id_veterinario, e.en_linea]))
      )
    );
    socket.on('estado_veterinario', ({ id_veterinario, en_linea }) =>
      setPresencia((p) => ({ ...p, [id_veterinario]: en_linea }))
    );
    socket.on('horario_actualizado', () => cargarConversaciones());
    socket.on('connect_error', (e) => {
      if (!socket.active) setError(`${e.message}. Vuelve a iniciar sesión.`); // token inválido o vencido
    });

    return () => socket.disconnect();
  }, [token, cargarConversaciones]);
  // El horario de atención se vuelve a evaluar cada 30 segundos (por si empieza o termina mientras tanto)
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
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
      if (r.aviso)
        setAvisos((a) => ({ ...a, [r.mensaje.id_mensaje]: r.aviso }));
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

  // Ep8-Hu4: estado de atención de cada veterinario (solo lo ve el propietario)
  const estadoDe = (c) =>
    c?.estado_atencion && {
      ...c.estado_atencion,
      en_linea: presencia[c.id_veterinario] ?? c.estado_atencion.en_linea,
    };
  const estadoActivo = estadoDe(conversacion);
  const horarioActivo =
    estadoActivo && estadoHorario(estadoActivo.horario, ahora);
  const avisoHorario =
    horarioActivo?.en_horario === false
      ? `${conversacion.nombre_contacto} está fuera de su horario de atención. Puedes dejarle tu mensaje: te responderá cuando vuelva a atender${
          horarioActivo.proxima_atencion
            ? ` (${textoProximaAtencion(horarioActivo.proxima_atencion)})`
            : ''
        }.`
      : '';

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
                // Ep8-Hu4: empieza a recibir el estado en línea de este veterinario
                socketRef.current
                  ?.timeout(3000)
                  .emitWithAck('seguir_veterinario', {
                    id_veterinario: c.id_veterinario,
                  })
                  .then((r) => {
                    if (r.estado)
                      setPresencia((p) => ({
                        ...p,
                        [r.estado.id_veterinario]: r.estado.en_linea,
                      }));
                  })
                  .catch(() => {});
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
                    <EstadoAtencion estado={estadoDe(c)} ahora={ahora} />
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
                  <EstadoAtencion
                    estado={estadoActivo}
                    ahora={ahora}
                    detallado
                  />
                </div>
              </div>

              <ol className="chat__mensajes">
                {mensajes.map((m) => {
                  const mio = m.id_remitente === yo.id_usuario;
                  return (
                    <Fragment key={m.id_mensaje}>
                      <li
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
                      {avisos[m.id_mensaje] && (
                        <li className="chat__aviso-mensaje" role="status">
                          {avisos[m.id_mensaje]}
                        </li>
                      )}
                    </Fragment>
                  );
                })}
                <li ref={finRef} aria-hidden="true" />
              </ol>

              {avisoHorario && (
                <p className="chat__aviso-horario" role="status">
                  {avisoHorario}
                </p>
              )}

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
              {v.estado_atencion?.en_linea ? ' · en línea' : ''}
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
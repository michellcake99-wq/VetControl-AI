import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, RotateCcw, SendHorizontal, Sparkles } from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import ResumenIA from '../components/historia/ResumenIA.jsx';
import './Asistente.css';

// Ep6-Hu3: interfaz de consulta del asistente de inteligencia artificial
const MAX_CARACTERES = 2000;
const MIN_CARACTERES = 3;
const AVISO_IA =
  'Respuesta generada por inteligencia artificial. Es un apoyo y no reemplaza el criterio del veterinario.';

const lista = (r) => (Array.isArray(r) ? r : (r?.datos ?? []));

const hora = (valor) =>
  new Intl.DateTimeFormat('es-EC', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(valor));

function sugerenciasPara(mascota) {
  if (!mascota) {
    return [
      '¿Cada cuánto debo desparasitar a mi mascota?',
      '¿Cómo cuido a mi mascota en época de calor?',
      '¿Cómo pido una cita en VetControl?',
    ];
  }
  return [
    `¿Qué vacunas le faltan a ${mascota.nombre}?`,
    `¿Qué tratamientos tiene activos ${mascota.nombre}?`,
    `¿Cuándo fue la última consulta de ${mascota.nombre}?`,
    `¿${mascota.nombre} tiene alguna alergia registrada?`,
  ];
}

export default function Asistente() {
  const esPropietario = rolActual() === 'propietario';

  const [mascotas, setMascotas] = useState(null);
  const [errorMascotas, setErrorMascotas] = useState('');
  // null = la primera mascota de la lista; '' = pregunta general (sin mascota)
  const [eleccion, setEleccion] = useState(null);

  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [cupo, setCupo] = useState(null);

  const contador = useRef(0);
  const finRef = useRef(null);

  const recargarCupo = useCallback(
    () =>
      api
        .get('/ia/cupo')
        .then(setCupo)
        .catch(() => {}),
    []
  );

  useEffect(() => {
    let cancelado = false;
    api
      .get('/mascotas?limite=100')
      .then((r) => {
        if (!cancelado) setMascotas(lista(r));
      })
      .catch((err) => {
        if (!cancelado) {
          setMascotas([]);
          setErrorMascotas(
            err.message || 'No se pudieron cargar las mascotas.'
          );
        }
      });
    recargarCupo();
    return () => {
      cancelado = true;
    };
  }, [recargarCupo]);

  // Mantener visible lo último de la conversación
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, pensando]);

  const idMascota = eleccion ?? mascotas?.[0]?.id_mascota ?? '';
  const mascota =
    mascotas?.find((m) => m.id_mascota === Number(idMascota)) ?? null;
  const agotado = cupo?.restantes === 0;
  const largo = texto.trim().length;
  const puedeEnviar = largo >= MIN_CARACTERES && !pensando && !agotado;

  const nuevoId = () => ++contador.current;

  const marcar = (id, cambios) =>
    setMensajes((ms) =>
      ms.map((m) => (m.id === id ? { ...m, ...cambios } : m))
    );

  async function consultar(mensaje) {
    setPensando(true);
    marcar(mensaje.id, { estado: 'enviado', error: '' });
    try {
      const r = await api.post('/ia/consultar', {
        pregunta: mensaje.texto,
        id_mascota: mensaje.idMascota || null,
      });
      setMensajes((ms) => [
        ...ms,
        {
          id: nuevoId(),
          tipo: 'asistente',
          texto: r.respuesta,
          aviso: r.aviso || AVISO_IA,
          hora: r.fecha,
        },
      ]);
      setCupo((c) => c && { ...c, restantes: r.consultas_restantes });
      if (r.consultas_restantes === 0) recargarCupo(); // para saber en cuántos minutos se libera
    } catch (err) {
      // La pregunta se queda en la conversación para poder reintentarla
      marcar(mensaje.id, {
        estado: 'error',
        error: err.message || 'No se pudo obtener la respuesta.',
      });
      recargarCupo(); // las consultas fallidas también cuentan para el límite
    } finally {
      setPensando(false);
    }
  }

  function preguntar(pregunta) {
    const mensaje = {
      id: nuevoId(),
      tipo: 'usuario',
      texto: pregunta.trim(),
      idMascota: idMascota || null,
      hora: new Date().toISOString(),
      estado: 'enviado',
    };
    setMensajes((ms) => [...ms, mensaje]);
    consultar(mensaje);
  }

  function enviar(e) {
    e.preventDefault();
    if (!puedeEnviar) return;
    const pregunta = texto;
    setTexto('');
    preguntar(pregunta);
  }

  function cambiarMascota(valor) {
    setEleccion(valor === '' ? '' : Number(valor));
    if (mensajes.length > 0) {
      const nueva = mascotas.find((m) => m.id_mascota === Number(valor));
      setMensajes((ms) => [
        ...ms,
        {
          id: nuevoId(),
          tipo: 'nota',
          texto: nueva
            ? `Ahora consultas sobre ${nueva.nombre}`
            : 'Ahora haces preguntas generales (sin una mascota en particular)',
        },
      ]);
    }
  }

  const reintentables = mensajes.filter((m) => m.estado === 'error');
  const ultimoConError = reintentables.at(-1)?.id;

  return (
    <section className="asistente">
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Asistente IA</h1>
          <p className="texto-sec">
            Pregunta sobre el cuidado de tus mascotas o sobre su historial.
            Responde con los datos registrados en la clínica.
          </p>
        </div>
      </div>

      <Alerta tipo="error">{errorMascotas}</Alerta>

      {mascotas === null ? (
        <CargandoInline texto="Cargando…" />
      ) : (
        <>
          <div className="tarjeta asistente__barra">
            <div className="campo asistente__selector">
              <label htmlFor="asistente-mascota">Mascota</label>
              <select
                id="asistente-mascota"
                value={idMascota}
                onChange={(e) => cambiarMascota(e.target.value)}
              >
                {mascotas.map((m) => (
                  <option key={m.id_mascota} value={m.id_mascota}>
                    {m.nombre}
                    {!esPropietario && m.nombre_propietario
                      ? ` · ${m.nombre_propietario}`
                      : ''}
                  </option>
                ))}
                <option value="">Pregunta general (sin mascota)</option>
              </select>
            </div>

            {cupo && (
              <p
                className={`asistente__cupo${cupo.restantes <= 3 ? ' asistente__cupo--poco' : ''}`}
                role="status"
              >
                {cupo.restantes === 1
                  ? 'Te queda 1 consulta'
                  : `Te quedan ${cupo.restantes} consultas`}{' '}
                <span>
                  de {cupo.limite} cada {cupo.ventana_minutos} min
                </span>
              </p>
            )}

            {mascota && (
              <div className="asistente__resumen">
                <ResumenIA
                  key={mascota.id_mascota}
                  idMascota={mascota.id_mascota}
                  nombreMascota={mascota.nombre}
                  onResumen={(r) => {
                    if (r)
                      setCupo(
                        (c) => c && { ...c, restantes: r.consultas_restantes }
                      );
                    else recargarCupo();
                  }}
                />
              </div>
            )}
          </div>

          {mascotas.length === 0 && esPropietario && (
            <p className="texto-sec asistente__sin-mascotas">
              Aún no tienes mascotas registradas. Puedes hacer preguntas
              generales o{' '}
              <Link to="/mascotas/nueva">registrar una mascota</Link> para
              consultar su historial.
            </p>
          )}

          <div className="tarjeta asistente__chat">
            <ol
              className="asistente__mensajes"
              role="log"
              aria-live="polite"
              aria-label="Conversación con el asistente"
            >
              {mensajes.length === 0 && (
                <li className="asistente__bienvenida">
                  <span
                    className="icono-circulo icono-circulo--44"
                    aria-hidden="true"
                  >
                    <Bot size={22} strokeWidth={1.8} />
                  </span>
                  <p>
                    <strong>Hola, soy el asistente de VetControl AI.</strong>
                    <br />
                    {mascota
                      ? `Puedo ayudarte con la información de ${mascota.nombre}. Escribe tu pregunta o elige una:`
                      : 'Escribe tu pregunta sobre el cuidado de tu mascota o elige una:'}
                  </p>
                  <div className="asistente__sugerencias">
                    {sugerenciasPara(mascota).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="asistente__sugerencia"
                        disabled={pensando || agotado}
                        onClick={() => preguntar(s)}
                      >
                        <Sparkles size={14} aria-hidden="true" />
                        {s}
                      </button>
                    ))}
                  </div>
                </li>
              )}

              {mensajes.map((m) => {
                if (m.tipo === 'nota') {
                  return (
                    <li key={m.id} className="asistente__nota">
                      {m.texto}
                    </li>
                  );
                }
                const mio = m.tipo === 'usuario';
                return (
                  <li
                    key={m.id}
                    className={`asistente__fila asistente__fila--${mio ? 'usuario' : 'asistente'}`}
                  >
                    <div
                      className={`asistente__burbuja asistente__burbuja--${mio ? 'usuario' : 'asistente'}`}
                    >
                      <span className="sr-only">
                        {mio ? 'Tú:' : 'Asistente:'}
                      </span>
                      <p>{m.texto}</p>
                      <time dateTime={m.hora}>{hora(m.hora)}</time>
                    </div>
                    {!mio && (
                      <p className="asistente__aviso texto-sec">{m.aviso}</p>
                    )}
                    {m.estado === 'error' && (
                      <div className="asistente__error" role="alert">
                        <span>{m.error}</span>
                        {m.id === ultimoConError && !pensando && (
                          <button
                            type="button"
                            className="boton boton--claro boton--peq"
                            onClick={() => consultar(m)}
                          >
                            <RotateCcw size={14} aria-hidden="true" />{' '}
                            Reintentar
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}

              {pensando && (
                <li className="asistente__fila asistente__fila--asistente">
                  <div
                    className="asistente__burbuja asistente__burbuja--asistente asistente__escribiendo"
                    role="status"
                    aria-label="El asistente está escribiendo"
                  >
                    <span />
                    <span />
                    <span />
                  </div>
                </li>
              )}
              <li ref={finRef} aria-hidden="true" />
            </ol>

            {agotado && (
              <p className="asistente__limite" role="alert">
                Alcanzaste el límite de {cupo.limite} consultas cada{' '}
                {cupo.ventana_minutos} minutos.
                {cupo.minutos_para_nueva
                  ? ` Podrás consultar de nuevo en ${cupo.minutos_para_nueva} ${cupo.minutos_para_nueva === 1 ? 'minuto' : 'minutos'}.`
                  : ''}
              </p>
            )}

            <form className="asistente__form" onSubmit={enviar}>
              <label htmlFor="asistente-texto" className="sr-only">
                Escribe tu pregunta
              </label>
              <textarea
                id="asistente-texto"
                rows={2}
                value={texto}
                maxLength={MAX_CARACTERES}
                disabled={agotado}
                placeholder={
                  agotado
                    ? 'Llegaste al límite de consultas'
                    : mascota
                      ? `Pregunta algo sobre ${mascota.nombre}…`
                      : 'Escribe tu pregunta…'
                }
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) enviar(e);
                }}
              />
              <span className="asistente__contador texto-sec">
                {largo}/{MAX_CARACTERES}
              </span>
              <button
                type="submit"
                className="boton boton--oscuro asistente__enviar"
                disabled={!puedeEnviar}
                aria-label="Enviar pregunta"
              >
                <SendHorizontal size={18} />
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}

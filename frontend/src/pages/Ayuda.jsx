import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  ChevronDown,
  ClipboardList,
  ClipboardPlus,
  Clock,
  Mail,
  MessageCircle,
  PawPrint,
  Phone,
  Search,
  Sparkles,
  Stethoscope,
  Syringe,
  User,
  Users,
} from 'lucide-react';
import { obtenerSesion, rolActual } from '../utils/sesion.js';
import {
  accesosDelRol,
  CONTACTO_CLINICA,
  hayContacto,
  preguntasDelRol,
} from '../utils/ayuda.js';
import './Ayuda.css';

// Lote C: Centro de ayuda (reemplaza la pantalla "en construcción" del botón ¿Necesitas ayuda?)
const ICONOS = {
  Calendar,
  CalendarPlus,
  ClipboardList,
  ClipboardPlus,
  MessageCircle,
  PawPrint,
  Sparkles,
  Stethoscope,
  Syringe,
  User,
  Users,
};

const SUBTITULO_POR_ROL = {
  propietario: 'Aquí encuentras cómo hacer lo más común con tus mascotas.',
  veterinario: 'Guías rápidas para tu trabajo diario en la plataforma.',
  administrador: 'Guías rápidas para gestionar la clínica en la plataforma.',
};

export default function Ayuda() {
  const rol = rolActual() ?? 'propietario';
  const nombre = obtenerSesion()?.usuario?.nombre?.trim().split(/\s+/)[0] ?? '';
  const [busqueda, setBusqueda] = useState('');

  const accesos = useMemo(() => accesosDelRol(rol), [rol]);
  const preguntas = useMemo(
    () => preguntasDelRol(rol, busqueda),
    [rol, busqueda]
  );
  const buscando = busqueda.trim().length > 0;

  return (
    <section className="ayuda">
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">
            {nombre
              ? `¿En qué te ayudamos, ${nombre}?`
              : '¿En qué te ayudamos?'}
          </h1>
          <p className="texto-sec">
            {SUBTITULO_POR_ROL[rol] ?? SUBTITULO_POR_ROL.propietario}
          </p>
        </div>
      </div>

      <div className="ayuda__buscador">
        <Search size={18} aria-hidden="true" />
        <label htmlFor="ayuda-buscar" className="sr-only">
          Buscar en la ayuda
        </label>
        <input
          id="ayuda-buscar"
          type="search"
          value={busqueda}
          maxLength={80}
          placeholder="Busca por ejemplo: cita, vacuna, contraseña…"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {!buscando && (
        <>
          <h2 className="ayuda__subtitulo">Accesos rápidos</h2>
          <ul className="ayuda__accesos">
            {accesos.map((a) => {
              const Icono = ICONOS[a.icono] ?? Sparkles;
              return (
                <li key={a.to}>
                  <Link to={a.to} className="tarjeta ayuda__acceso">
                    <span className="ayuda__acceso-icono" aria-hidden="true">
                      <Icono size={20} />
                    </span>
                    <span>
                      <strong>{a.titulo}</strong>
                      <span className="texto-sec">{a.detalle}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="ayuda__subtitulo">
        {buscando ? 'Resultados' : 'Preguntas frecuentes'}
      </h2>

      {preguntas.length === 0 ? (
        <div className="tarjeta ayuda__vacio" role="status">
          <p>
            No encontramos resultados para <strong>“{busqueda.trim()}”</strong>.
          </p>
          <p className="texto-sec">
            Prueba con otra palabra o pregúntale a NubiVet, nuestro asistente.
          </p>
          <Link to="/asistente" className="boton boton--oscuro">
            <Sparkles size={16} aria-hidden="true" /> Preguntar a NubiVet
          </Link>
        </div>
      ) : (
        // key: al empezar o terminar una búsqueda se vuelven a pintar para abrir/cerrar las respuestas
        <div
          className="ayuda__preguntas"
          key={buscando ? 'busqueda' : 'normal'}
        >
          {preguntas.map((p) => (
            <details
              key={p.pregunta}
              className="tarjeta ayuda__pregunta"
              open={buscando && preguntas.length <= 3}
            >
              <summary>
                <span>
                  <small className="ayuda__tema">{p.tema}</small>
                  {p.pregunta}
                </span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="ayuda__respuesta">
                <p>{p.respuesta}</p>
                {p.enlace && (
                  <Link to={p.enlace.to} className="ayuda__enlace">
                    {p.enlace.texto} →
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="tarjeta ayuda__contacto">
        <h2 className="ayuda__subtitulo">¿Sigues con dudas?</h2>
        <ul>
          {rol !== 'administrador' && (
            <li>
              <MessageCircle size={18} aria-hidden="true" />
              <span>
                {rol === 'propietario'
                  ? 'Escríbele a tu veterinario desde '
                  : 'Atiende a tus propietarios desde '}
                <Link to="/chat">Mensajes</Link>.
              </span>
            </li>
          )}
          <li>
            <Sparkles size={18} aria-hidden="true" />
            <span>
              Pregúntale a <Link to="/asistente">NubiVet</Link>, el asistente de
              IA.
            </span>
          </li>
          {CONTACTO_CLINICA.correo && (
            <li>
              <Mail size={18} aria-hidden="true" />
              <a href={`mailto:${CONTACTO_CLINICA.correo}`}>
                {CONTACTO_CLINICA.correo}
              </a>
            </li>
          )}
          {CONTACTO_CLINICA.telefono && (
            <li>
              <Phone size={18} aria-hidden="true" />
              <a href={`tel:${CONTACTO_CLINICA.telefono.replace(/\s+/g, '')}`}>
                {CONTACTO_CLINICA.telefono}
              </a>
            </li>
          )}
          {CONTACTO_CLINICA.horario && (
            <li>
              <Clock size={18} aria-hidden="true" />
              <span>{CONTACTO_CLINICA.horario}</span>
            </li>
          )}
          {!hayContacto() && rol === 'administrador' && (
            <li>
              <Mail size={18} aria-hidden="true" />
              <span className="texto-sec">
                Los datos de contacto de la clínica aún no están configurados.
              </span>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

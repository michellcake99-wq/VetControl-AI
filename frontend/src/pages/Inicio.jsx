import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  PawPrint,
  Pill,
  Plus,
  Search,
  Syringe,
  User,
} from 'lucide-react';
import { usuario } from '../data/mockData.js';
import { fechaLarga } from '../utils/format.js';
import { obtenerSesion } from '../utils/sesion.js';
import { calcularEdad } from '../utils/mascotas.js';
import {
  diaClinica,
  horaClinica,
  etiquetaTipoConsulta,
} from '../utils/citas.js';
import { cargarResumenInicio } from '../utils/resumenInicio.js';
import FotoMascota from '../components/FotoMascota.jsx';
import emblema from '../assets/logo-emblema.png';

const EN_CARRUSEL = 6; // mascotas que se muestran en el inicio; el resto, en «Ver todas»

const SIMBOLO_SEXO = {
  macho: { simbolo: '♂', clase: 'macho', texto: 'Macho' },
  hembra: { simbolo: '♀', clase: 'hembra', texto: 'Hembra' },
};

const LEMAS = {
  propietario: 'El cuidado de tu mascota, más inteligente y organizado.',
  veterinario: 'El cuidado de tus pacientes, más inteligente y organizado.',
  administrador: 'La gestión de la clínica, más inteligente y organizada.',
};

const SUBTITULOS = {
  propietario:
    'Gestiona citas, vacunas, tratamientos e historia clínica desde un solo lugar.',
  veterinario:
    'Tu agenda, tus pacientes y sus historias clínicas, en un solo lugar.',
  administrador: 'Un vistazo a la clínica: pacientes, citas y equipo.',
};

/** Partes de la fecha de una cita en la hora de la clínica: { semana: "Jue", dia: "19", mes: "nov" } */
function partesCita(valor) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'America/Bogota',
    })
      .formatToParts(new Date(valor))
      .map((p) => [p.type, p.value.replace('.', '')])
  );
  return {
    semana: partes.weekday.charAt(0).toUpperCase() + partes.weekday.slice(1),
    dia: partes.day,
    mes: partes.month.slice(0, 3),
  };
}

/** "Jue, 19 nov" */
const diaCorto = (valor) => {
  const { semana, dia, mes } = partesCita(valor);
  return `${semana}, ${dia} ${mes}`;
};

function Metrica({ to, icono: Icono, titulo, valor, detalle, color }) {
  return (
    <Link to={to} className={`tarjeta metrica-inicio metrica-inicio--${color}`}>
      <span className="metrica-inicio__icono" aria-hidden="true">
        <Icono size={22} strokeWidth={1.9} />
      </span>
      <span className="metrica-inicio__texto">
        <span className="metrica-inicio__titulo">{titulo}</span>
        <strong className="metrica-inicio__valor">{valor}</strong>
        <span className="metrica-inicio__detalle">{detalle}</span>
      </span>
      <ChevronRight
        size={18}
        className="metrica-inicio__flecha"
        aria-hidden="true"
      />
    </Link>
  );
}

function TarjetaCarrusel({ mascota, esPropietario }) {
  const sexo = SIMBOLO_SEXO[mascota.sexo];
  const estado = mascota.estado;
  return (
    <li className="carrusel__item">
      <Link to={`/mascotas/${mascota.id_mascota}`} className="mini-tarjeta">
        <span className="mini-tarjeta__cabecera">
          <FotoMascota mascota={mascota} tamano={64} />
          <span className="mini-tarjeta__nombre">
            <strong>
              {mascota.nombre}
              {sexo && (
                <span
                  className={`sexo sexo--${sexo.clase}`}
                  title={sexo.texto}
                  aria-label={sexo.texto}
                >
                  {sexo.simbolo}
                </span>
              )}
            </strong>
            <span>
              {mascota.raza || mascota.especie}
              {mascota.fecha_nacimiento &&
                ` · ${calcularEdad(mascota.fecha_nacimiento)}`}
            </span>
          </span>
        </span>

        {esPropietario && estado ? (
          <span className="mini-tarjeta__estados">
            <span className={`punto punto--${estado.vacunas}`}>
              {estado.vacunas === 'al-dia'
                ? 'Vacunas al día'
                : estado.vacunas === 'pendientes'
                  ? 'Vacunas pendientes'
                  : 'Sin vacunas registradas'}
            </span>
            <span
              className={`punto punto--${estado.tratamientosActivos ? 'tratamiento' : 'al-dia'}`}
            >
              {estado.tratamientosActivos
                ? `${estado.tratamientosActivos === 1 ? 'Tratamiento' : `${estado.tratamientosActivos} tratamientos`} en curso`
                : 'Sin tratamientos'}
            </span>
          </span>
        ) : (
          mascota.nombre_propietario && (
            <span className="mini-tarjeta__dueno">
              <User size={13} aria-hidden="true" />
              {mascota.nombre_propietario}
            </span>
          )
        )}

        <span className="mini-tarjeta__ver">
          Ver ficha <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

/** Carrusel horizontal con flechas (en el celular también se desliza con el dedo). */
function Carrusel({ children }) {
  const pista = useRef(null);
  const [extremos, setExtremos] = useState({ inicio: true, fin: true });

  function medir() {
    const el = pista.current;
    if (!el) return;
    setExtremos({
      inicio: el.scrollLeft <= 4,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    const observador =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observador?.observe(el);
    const t = setTimeout(medir, 0);
    return () => {
      clearTimeout(t);
      observador?.disconnect();
    };
  }, [children]);

  const mover = (sentido) =>
    pista.current?.scrollBy({
      left: sentido * pista.current.clientWidth * 0.85,
      behavior: 'smooth',
    });

  return (
    <div className="carrusel">
      {!extremos.inicio && (
        <button
          type="button"
          className="carrusel__flecha carrusel__flecha--izq"
          onClick={() => mover(-1)}
          aria-label="Ver anteriores"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <ul className="carrusel__pista" ref={pista} onScroll={medir}>
        {children}
      </ul>
      {!extremos.fin && (
        <button
          type="button"
          className="carrusel__flecha carrusel__flecha--der"
          onClick={() => mover(1)}
          aria-label="Ver más"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}

export default function Inicio() {
  // Nombre del usuario que inició sesión (si no hay sesión, se usan los datos de ejemplo)
  const cuenta = obtenerSesion()?.usuario ?? usuario;
  const rol = cuenta.rol;
  const esPropietario = rol === 'propietario';
  const tituloMascotas = esPropietario ? 'Mis mascotas' : 'Pacientes';

  // Resumen real desde la API, según lo que el usuario puede ver por su rol
  const [resumen, setResumen] = useState(null);
  const [errorResumen, setErrorResumen] = useState('');

  useEffect(() => {
    let cancelado = false;
    cargarResumenInicio(rol)
      .then((datos) => {
        if (!cancelado) setResumen(datos);
      })
      .catch(() => {
        if (!cancelado) {
          setErrorResumen(
            'No se pudo cargar tu resumen. Intenta recargar la página.'
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [rol]);

  const cargando = !resumen && !errorResumen;
  const proxima = resumen?.proximaCita ?? null;
  const mascotas = resumen?.mascotas ?? [];
  const enCarrusel = mascotas.slice(0, EN_CARRUSEL);
  const restantes = (resumen?.totalMascotas ?? 0) - enCarrusel.length;
  // Fotos de las mascotas en el saludo (solo el propietario)
  const fotosSaludo = esPropietario
    ? mascotas.filter((m) => m.foto).slice(0, 2)
    : [];

  const terceraMetrica = esPropietario
    ? {
        to: '/mascotas',
        icono: Pill,
        titulo: 'Tratamientos activos',
        valor: resumen ? (resumen.tratamientosActivos ?? 0) : '—',
        detalle: 'en curso',
        color: 'verde',
      }
    : {
        to: '/citas',
        icono: CalendarClock,
        titulo: 'Citas de hoy',
        valor: resumen ? resumen.citasHoy : '—',
        detalle: resumen?.citasHoy === 1 ? 'pendiente hoy' : 'pendientes hoy',
        color: 'verde',
      };

  // Ep5-Hu4: porcentaje de vacunas al día, calculado con los pendientes de cada mascota
  const metricaVacunas = esPropietario
    ? {
        to: '/vacunas',
        icono: Syringe,
        titulo: 'Vacunas al día',
        valor: !resumen
          ? '—'
          : resumen.vacunasAlDia === null
            ? 'Sin datos'
            : `${resumen.vacunasAlDia}%`,
        detalle:
          resumen?.vacunasAlDia === null
            ? 'sin vacunas registradas'
            : 'de tus mascotas',
        color: 'celeste',
      }
    : null;

  const preguntasIA = esPropietario
    ? [
        mascotas[0] && `¿Cuándo es la próxima vacuna de ${mascotas[0].nombre}?`,
        mascotas[1]
          ? `Resume la historia clínica de ${mascotas[1].nombre}.`
          : '¿Qué cuidados necesita mi mascota este mes?',
        '¿Qué seguimientos tengo pendientes?',
      ]
    : [
        'Resume la historia clínica de un paciente.',
        '¿Qué pacientes tienen refuerzos vencidos?',
        '¿Qué seguimientos tengo pendientes esta semana?',
      ];

  return (
    <div className="inicio inicio-v2">
      {/* Saludo */}
      <section className="hola" aria-labelledby="hola-titulo">
        <div className="hola__texto">
          <p className="hola__fecha">{fechaLarga()}</p>
          <h1 id="hola-titulo" className="hola__titulo">
            ¡Hola, {cuenta.nombre}!{' '}
            <span className="hola__mano" aria-hidden="true">
              👋
            </span>
          </h1>
          <p className="hola__lema">{LEMAS[rol]}</p>
          <p className="hola__sub">{SUBTITULOS[rol]}</p>
        </div>
        <div className="hola__arte" aria-hidden="true">
          <span className="hola__burbuja hola__burbuja--1" />
          <span className="hola__burbuja hola__burbuja--2" />
          <span className="hola__burbuja hola__burbuja--3" />
          {fotosSaludo.length > 0 ? (
            <span className="hola__fotos">
              {fotosSaludo.map((m) => (
                <img key={m.id_mascota} src={m.foto} alt="" />
              ))}
            </span>
          ) : (
            <span className="hola__emblema">
              <img src={emblema} alt="" />
            </span>
          )}
          <span className="hola__icono hola__icono--corazon">
            <HeartPulse size={24} />
          </span>
          <span className="hola__icono hola__icono--huella">
            <PawPrint size={20} />
          </span>
          <span className="hola__icono hola__icono--mas">
            <Plus size={22} strokeWidth={3} />
          </span>
        </div>
      </section>

      {errorResumen && <p className="texto-sec">{errorResumen}</p>}

      {/* Métricas */}
      <section
        className={`metricas-inicio${metricaVacunas ? ' metricas-inicio--cuatro' : ''}`}
        aria-label="Resumen"
      >
        <Metrica
          to="/mascotas"
          icono={PawPrint}
          titulo={tituloMascotas}
          valor={resumen ? resumen.totalMascotas : '—'}
          detalle={
            esPropietario
              ? resumen?.totalMascotas === 1
                ? 'registrada'
                : 'registradas'
              : 'en la clínica'
          }
          color="azul"
        />
        <Metrica
          to="/citas"
          icono={Calendar}
          titulo="Próxima cita"
          valor={
            cargando
              ? '—'
              : proxima
                ? diaCorto(proxima.fecha_hora)
                : 'Sin citas'
          }
          detalle={
            proxima
              ? `${horaClinica(proxima.fecha_hora)} · ${proxima.nombre_mascota}`
              : esPropietario
                ? 'Agenda una cuando la necesites'
                : 'No hay citas pendientes'
          }
          color="celeste"
        />
        <Metrica {...terceraMetrica} />
        {metricaVacunas && <Metrica {...metricaVacunas} />}
      </section>

      {/* Carrusel de mascotas / pacientes */}
      <section
        className="tarjeta bloque-inicio"
        aria-labelledby="mascotas-titulo"
      >
        <div className="bloque-inicio__cabecera">
          <h2 id="mascotas-titulo" className="bloque-inicio__titulo">
            {tituloMascotas}
          </h2>
          <Link to="/mascotas" className="bloque-inicio__ver">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        {cargando ? (
          <p className="texto-sec">Cargando…</p>
        ) : mascotas.length === 0 ? (
          <div className="bloque-inicio__vacio">
            <p className="texto-sec">
              {esPropietario
                ? 'Aún no registras mascotas.'
                : 'Aún no hay pacientes registrados.'}
            </p>
            <Link
              to="/mascotas/nueva"
              className="boton boton--oscuro boton--peq"
            >
              <Plus size={14} /> Registrar mascota
            </Link>
          </div>
        ) : (
          <Carrusel>
            {enCarrusel.map((m) => (
              <TarjetaCarrusel
                key={m.id_mascota}
                mascota={m}
                esPropietario={esPropietario}
              />
            ))}
            {restantes > 0 && (
              <li className="carrusel__item carrusel__item--mas">
                <Link to="/mascotas" className="mini-tarjeta mini-tarjeta--mas">
                  <span className="mini-tarjeta__mas-numero">+{restantes}</span>
                  <span>Ver todas</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            )}
          </Carrusel>
        )}
      </section>

      <div className="inicio-v2__inferior">
        {/* Próximas citas */}
        <section
          className="tarjeta bloque-inicio"
          aria-labelledby="citas-titulo"
        >
          <div className="bloque-inicio__cabecera">
            <h2 id="citas-titulo" className="bloque-inicio__titulo">
              <Calendar size={18} aria-hidden="true" /> Próximas citas
            </h2>
            <Link to="/citas" className="bloque-inicio__ver">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          {cargando ? (
            <p className="texto-sec">Cargando…</p>
          ) : resumen?.proximasCitas?.length ? (
            <ul className="citas-inicio">
              {resumen.proximasCitas.map((c) => (
                <li key={c.id_cita}>
                  <Link to="/citas" className="cita-inicio">
                    <span className="cita-inicio__fecha">
                      <strong>{partesCita(c.fecha_hora).dia}</strong>
                      <span>{partesCita(c.fecha_hora).mes}</span>
                    </span>
                    <span className="cita-inicio__texto">
                      <strong>
                        {c.nombre_mascota} ·{' '}
                        {etiquetaTipoConsulta(c.tipo_consulta)}
                      </strong>
                      <span>
                        {horaClinica(c.fecha_hora)} ·{' '}
                        {esPropietario
                          ? c.nombre_veterinario
                          : c.nombre_propietario}
                      </span>
                    </span>
                    {diaClinica(c.fecha_hora) === diaClinica(new Date()) && (
                      <span className="cita-inicio__hoy">Hoy</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bloque-inicio__vacio">
              <p className="texto-sec">No hay citas próximas.</p>
              <Link
                to="/citas/nueva"
                className="boton boton--oscuro boton--peq"
              >
                <Plus size={14} />{' '}
                {esPropietario ? 'Solicitar cita' : 'Agendar cita'}
              </Link>
            </div>
          )}
        </section>

        {/* Asistente IA */}
        <section
          className="tarjeta bloque-inicio bloque-ia"
          aria-labelledby="ia-titulo"
        >
          <h2 id="ia-titulo" className="bloque-inicio__titulo">
            <span className="bloque-ia__icono" aria-hidden="true">
              <Bot size={20} />
            </span>
            VetControl AI
          </h2>
          <p className="bloque-ia__pregunta">¿Qué quieres consultar?</p>
          <ul className="bloque-ia__sugerencias">
            {preguntasIA.filter(Boolean).map((pregunta) => (
              <li key={pregunta}>
                <Link to="/asistente" state={{ pregunta }}>
                  <Search size={15} aria-hidden="true" />
                  {pregunta}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/asistente" className="boton bloque-ia__boton">
            Consultar a VetControl AI <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
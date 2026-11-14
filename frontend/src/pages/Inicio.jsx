import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PawPrint,
  Calendar,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Dog,
} from 'lucide-react';
import { usuario } from '../data/mockData.js';
import { fechaLarga, fechaCita } from '../utils/format.js';
import { obtenerSesion } from '../utils/sesion.js';
import { cargarResumenInicio } from '../utils/resumenInicio.js';

const accesos = [
  { to: '/mascotas/nueva', label: 'Registrar mascota', icon: PawPrint },
  { to: '/asistente', label: 'Consultar al asistente IA', icon: Sparkles },
  { to: '/citas/nueva', label: 'Agendar una cita', icon: Calendar },
];

export default function Inicio() {
  // Nombre del usuario que inició sesión (si no hay sesión, se usan los datos de ejemplo)
  const cuenta = obtenerSesion()?.usuario ?? usuario;

  // Resumen real desde la API: mascotas, citas próximas y vacunas del usuario
  const [resumen, setResumen] = useState(null);
  const [errorResumen, setErrorResumen] = useState('');

  useEffect(() => {
    let cancelado = false;
    cargarResumenInicio(cuenta.rol)
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
  }, [cuenta.rol]);

  const cargando = !resumen && !errorResumen;
  const proximaCita = resumen?.proximaCita ?? null;
  const vacunas = resumen?.vacunasAlDia ?? null;
  const esPropietario = cuenta.rol === 'propietario';

  const metricas = [
    {
      titulo: esPropietario ? 'Mis mascotas' : 'Mascotas',
      valor: resumen ? resumen.totalMascotas : '—',
      detalle:
        resumen?.totalMascotas === 1
          ? 'compañero registrado'
          : 'compañeros registrados',
      icon: PawPrint,
    },
    {
      titulo: 'Próximas citas',
      valor: resumen ? resumen.totalCitas : '—',
      detalle: resumen?.totalCitas === 1 ? 'cita por venir' : 'citas por venir',
      icon: Calendar,
    },
    {
      titulo: 'Vacunas al día',
      valor: vacunas === null ? '—' : `${vacunas}%`,
      detalle:
        vacunas !== null
          ? vacunas >= 80
            ? '¡Vas por buen camino!'
            : 'Revisa las vacunas pendientes'
          : cargando
            ? 'Calculando…'
            : resumen?.vacunasCalculadas
              ? 'Sin vacunas registradas'
              : 'Consúltalas en la historia de cada mascota',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="inicio">
      <header className="saludo">
        <p className="saludo__fecha">{fechaLarga()}</p>
        <h1 className="saludo__titulo">¡Hola, {cuenta.nombre}!</h1>
        <p className="texto-sec">
          Todo listo para cuidar mejor de tus compañeros peludos.
        </p>
      </header>

      <section className="banner" aria-labelledby="banner-titulo">
        <div className="banner__texto">
          <h2 id="banner-titulo" className="banner__titulo">
            Su bienestar,
            <br />
            nuestra prioridad.
          </h2>
          <p className="banner__sub">
            Organiza su salud y mantén cada cuidado al día.
          </p>
          <Link to="/mascotas" className="boton boton--claro">
            Explorar mis mascotas
          </Link>
        </div>
        <div className="banner__arte" aria-hidden="true">
          <span className="banner__circulo banner__circulo--grande" />
          <span className="banner__circulo banner__circulo--chico" />
          <PawPrint className="banner__huella" size={46} strokeWidth={1.8} />
        </div>
      </section>

      <section className="metricas" aria-label="Resumen">
        {metricas.map(({ titulo, valor, detalle, icon: Icon }) => (
          <article key={titulo} className="tarjeta metrica">
            <div className="metrica__cabecera">
              <span
                className="icono-circulo icono-circulo--44"
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <h2 className="metrica__titulo">{titulo}</h2>
            </div>
            <p className="metrica__valor">
              <strong>{valor}</strong> <span>{detalle}</span>
            </p>
          </article>
        ))}
      </section>

      <div className="inferior">
        <section className="tarjeta seccion" aria-labelledby="cita-titulo">
          <h2 id="cita-titulo" className="seccion__titulo">
            Tu próxima cita
          </h2>
          <p className="texto-sec">No pierdas de vista su próximo control.</p>

          {errorResumen && <p className="texto-sec">{errorResumen}</p>}
          {cargando ? (
            <p className="cita cita--vacia">Cargando tu próxima cita…</p>
          ) : proximaCita ? (
            <>
              <Link to="/citas" className="cita">
                <span className="cita__avatar" aria-hidden="true">
                  <Dog size={34} strokeWidth={1.7} />
                </span>
                <span className="cita__info">
                  <span className="cita__titulo">
                    {proximaCita.nombre_mascota} · {proximaCita.motivo}
                  </span>
                  <span className="cita__fecha">
                    {fechaCita(proximaCita.fecha_hora)}
                  </span>
                  <span className="cita__lugar">
                    Con {proximaCita.nombre_veterinario}
                  </span>
                </span>
                <ChevronRight
                  className="chevron"
                  size={24}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </Link>
              <p className="texto-sec cita__nota">
                Recuerda llegar 10 minutos antes.
              </p>
            </>
          ) : (
            <p className="cita cita--vacia">
              No tienes citas próximas. Agenda una para mantener sus controles
              al día.
            </p>
          )}
          <Link to="/citas" className="boton boton--oscuro">
            Ver todas las citas
          </Link>
        </section>

        <section className="tarjeta seccion" aria-labelledby="accesos-titulo">
          <h2 id="accesos-titulo" className="seccion__titulo">
            Accesos rápidos
          </h2>
          <p className="texto-sec">Lo que necesitas, en un solo lugar.</p>
          <ul className="accesos">
            {accesos.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="acceso">
                  <span
                    className="icono-circulo icono-circulo--36"
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="acceso__texto">{label}</span>
                  <ChevronRight
                    className="chevron"
                    size={20}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
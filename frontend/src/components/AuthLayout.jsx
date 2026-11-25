import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import emblema from '../assets/logo-emblema.png';
import fotoAuth from '../assets/mascotas-auth.png';
import {
  IconoCorazon,
  IconoHistoria,
  IconoIA,
  IconoVacuna,
} from './IconosAuth.jsx';
import '../estilos/auth.css';

// Íconos con los colores de la paleta (se pintan con currentColor desde auth-pantalla.css)
const puntos = [
  { Icono: IconoHistoria, texto: 'Historia clínica digital de cada mascota' },
  { Icono: IconoVacuna, texto: 'Citas y carné de vacunación siempre al día' },
  {
    Icono: IconoIA,
    texto: 'Asistente de inteligencia artificial para tus dudas',
  },
];

// Huellas decorativas de la mitad derecha: posición (%), tamaño (px) y giro (grados)
const huellas = [
  { x: 7, y: 11, s: 54, r: -18 },
  { x: 3, y: 47, s: 42, r: 12 },
  { x: 13, y: 86, s: 40, r: -10 },
  { x: 90, y: 40, s: 52, r: 16 },
  { x: 91, y: 88, s: 44, r: -14 },
];

// Estructura común de las pantallas de registro, inicio de sesión y recuperación de contraseña.
// Dos mitades iguales: marca e imagen a la izquierda, formulario a la derecha.
export default function AuthLayout({ titulo, subtitulo, children, pie }) {
  const [fotoOk, setFotoOk] = useState(true);

  return (
    <div className="auth">
      {/* Fondo claro de la mitad derecha, con huellas decorativas */}
      <div className="auth__claro" aria-hidden="true">
        {huellas.map((h, i) => (
          <PawPrint
            key={i}
            className="auth__huella"
            size={h.s}
            fill="currentColor"
            strokeWidth={0}
            style={{
              left: `${h.x}%`,
              top: `${h.y}%`,
              '--giro': `${h.r}deg`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>
      <span className="auth__onda" aria-hidden="true" />

      <aside className="auth__panel">
        {/* Logo sin óvalo: el emblema lleva su propio borde blanco para destacar sobre el fondo */}
        <Link
          to="/"
          className="auth__logo"
          aria-label="VetControl AI, ir al inicio"
        >
          <img src={emblema} alt="" width="76" height="76" />
          <span>
            VetControl <b>AI</b>
          </span>
        </Link>

        <div className="auth__mensaje">
          <h2 className="auth__lema">
            Gestión clínica e inteligencia artificial para el{' '}
            <span>bienestar animal</span>
          </h2>
          <svg
            className="auth__trazo"
            viewBox="0 0 160 14"
            aria-hidden="true"
          >
            <path
              d="M2 11 C 50 2, 110 2, 158 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="auth__intro">
            Cuida, monitorea y toma decisiones informadas para tus mascotas.
          </p>
          <ul className="auth__puntos">
            {puntos.map(({ Icono, texto }) => (
              <li key={texto}>
                <span className="auth__punto-icono" aria-hidden="true">
                  <Icono size={28} style={{ color: '#17647a' }} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        {/* Imagen completa (sin recortar) apoyada en la base de la mitad izquierda */}
        {fotoOk && (
          <div className="auth__escena" aria-hidden="true">
            <img
              className="auth__foto"
              src={fotoAuth}
              alt=""
              onError={() => setFotoOk(false)}
            />
          </div>
        )}

        <p className="auth__firma">
          Juntos por una vida más saludable
          <IconoCorazon className="auth__firma-icono" size={28} />
        </p>
      </aside>

      <main className="auth__contenido">
        <section className="auth__tarjeta" aria-labelledby="auth-titulo">
          <header className="auth__cabecera">
            <PawPrint
              className="auth__cabecera-icono"
              size={44}
              fill="currentColor"
              strokeWidth={0}
              aria-hidden="true"
            />
            <h1 id="auth-titulo" className="auth__titulo">
              {titulo}
            </h1>
          </header>
          <p className="auth__subtitulo">{subtitulo}</p>
          <span className="auth__linea" aria-hidden="true" />
          {children}
          {pie && <p className="auth__pie">{pie}</p>}
        </section>
      </main>
    </div>
  );
}

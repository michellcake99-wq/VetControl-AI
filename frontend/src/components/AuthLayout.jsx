import { Link } from 'react-router-dom';
import { Calendar, PawPrint, Sparkles } from 'lucide-react';
import '../estilos/auth.css';

const puntos = [
  { icon: PawPrint, texto: 'Historia clínica digital de cada mascota' },
  { icon: Calendar, texto: 'Citas y carné de vacunación siempre al día' },
  {
    icon: Sparkles,
    texto: 'Asistente de inteligencia artificial para tus dudas',
  },
];

// Estructura común de las pantallas de registro e inicio de sesión
export default function AuthLayout({ titulo, subtitulo, children, pie }) {
  return (
    <div className="auth">
      <aside className="auth__panel">
        <Link to="/" className="marca">
          <span className="marca__emblema" aria-hidden="true">
            <Sparkles size={20} strokeWidth={2.2} />
          </span>
          <span className="marca__texto">
            <span className="marca__nombre">VetControl</span>
            <span className="marca__sub">AI · Cuidado inteligente</span>
          </span>
        </Link>

        <div className="auth__mensaje">
          <h2 className="auth__lema">
            Gestión clínica e inteligencia artificial para el bienestar animal
          </h2>
          <ul className="auth__puntos">
            {puntos.map(({ icon: Icon, texto }) => (
              <li key={texto}>
                <span
                  className="icono-circulo icono-circulo--36"
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <span
          className="auth__circulo auth__circulo--grande"
          aria-hidden="true"
        />
        <span
          className="auth__circulo auth__circulo--chico"
          aria-hidden="true"
        />
      </aside>

      <main className="auth__contenido">
        <section
          className="tarjeta auth__tarjeta"
          aria-labelledby="auth-titulo"
        >
          <h1 id="auth-titulo" className="auth__titulo">
            {titulo}
          </h1>
          <p className="texto-sec">{subtitulo}</p>
          {children}
        </section>
        {pie && <p className="auth__pie">{pie}</p>}
      </main>
    </div>
  );
}

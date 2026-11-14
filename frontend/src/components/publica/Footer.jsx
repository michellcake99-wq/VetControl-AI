import { Link } from 'react-router-dom';
import { Mail, GitBranch } from 'lucide-react';
import Logo from './Logo.jsx';
import { secciones, proyecto } from '../../data/paginaPublica.js';

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__superior">
        <div className="lp-footer__marca">
          <Logo conLema={false} />
          <p>{proyecto.descripcion}</p>
        </div>

        <nav className="lp-footer__col" aria-label="Plataforma">
          <h2>Plataforma</h2>
          <ul>
            {secciones.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="lp-footer__col" aria-label="Acceso">
          <h2>Acceso</h2>
          <ul>
            <li>
              <Link to="/iniciar-sesion">Iniciar sesión</Link>
            </li>
            <li>
              <Link to="/registro">Registrarse</Link>
            </li>
          </ul>
        </nav>

        <div className="lp-footer__col">
          <h2>Proyecto</h2>
          <ul>
            <li>{proyecto.programa}</li>
            <li>{proyecto.universidad}</li>
            <li>{proyecto.colaboracion}</li>
          </ul>
        </div>

        <div className="lp-footer__col">
          <h2>Contacto</h2>
          <ul>
            <li>
              <a
                href={`mailto:${proyecto.correo}`}
                className="lp-footer__icono"
              >
                <Mail size={15} aria-hidden="true" />
                {proyecto.correo}
              </a>
            </li>
            <li>
              <a
                href={proyecto.repositorio}
                target="_blank"
                rel="noreferrer"
                className="lp-footer__icono"
              >
                <GitBranch size={15} aria-hidden="true" />
                Repositorio en GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="lp-footer__inferior">
        <p>© 2026 VetControl AI. Todos los derechos reservados.</p>
        <p>Proyecto académico · {proyecto.programa}</p>
      </div>
    </footer>
  );
}

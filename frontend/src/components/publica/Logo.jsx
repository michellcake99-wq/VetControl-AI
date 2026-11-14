import { Link } from 'react-router-dom';
import emblema from '../../assets/logo-emblema.png';

// Emblema del logo (sin texto) + nombre de la marca, como en el prototipo
export default function Logo({ conLema = true, to = '/' }) {
  return (
    <Link to={to} className="lp-logo" aria-label="VetControl AI, ir al inicio">
      <span className="lp-logo__emblema" aria-hidden="true">
        <img src={emblema} alt="" width="60" height="60" />
      </span>
      <span className="lp-logo__texto">
        <span className="lp-logo__nombre">
          VetControl <span className="lp-logo__ai">AI</span>
        </span>
        {conLema && (
          <span className="lp-logo__lema">GESTIÓN VETERINARIA INTELIGENTE</span>
        )}
      </span>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccesoDenegado() {
  return (
    <div className="vacio">
      <span className="icono-circulo icono-circulo--44" aria-hidden="true">
        <ShieldAlert size={22} strokeWidth={1.8} />
      </span>
      <div>
        <h1 className="saludo__titulo">Acceso denegado</h1>
        <p className="texto-sec">
          Tu cuenta no tiene permiso para ver esta sección.
        </p>
      </div>
      <Link to="/inicio" className="boton boton--oscuro">
        Volver al inicio
      </Link>
    </div>
  );
}

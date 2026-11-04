import { Link } from 'react-router-dom';

// Vista temporal para las secciones que se desarrollan en otras historias de usuario.
export default function EnConstruccion({ titulo }) {
  return (
    <section className="vacio">
      <h1 className="saludo__titulo">{titulo}</h1>
      <p className="texto-sec">
        Esta sección se desarrollará en una próxima historia de usuario.
      </p>
      <Link to="/inicio" className="boton boton--oscuro">
        Volver al inicio
      </Link>
    </section>
  );
}

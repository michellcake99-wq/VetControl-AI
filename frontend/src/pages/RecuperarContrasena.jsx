import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';

// Vista temporal: la recuperación de contraseña se desarrolla en la historia Ep7-Hu4.
export default function RecuperarContrasena() {
  return (
    <AuthLayout
      titulo="Recuperar contraseña"
      subtitulo="Esta función se desarrollará en una próxima historia de usuario (Ep7-Hu4)."
    >
      <Link to="/iniciar-sesion" className="boton boton--oscuro auth__enviar">
        Volver a iniciar sesión
      </Link>
    </AuthLayout>
  );
}

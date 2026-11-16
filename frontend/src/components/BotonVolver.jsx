import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Flecha para devolverse a la pantalla anterior.
 * Si la persona llegó directo (por ejemplo, pegando el enlace), va a la ruta "a".
 */
export default function BotonVolver({ a, texto = 'Volver' }) {
  const navegar = useNavigate();
  function volver() {
    // window.history.state.idx lo pone React Router: > 0 si hay una pantalla anterior en la app
    if ((window.history.state?.idx ?? 0) > 0) navegar(-1);
    else navegar(a);
  }
  return (
    <button
      type="button"
      className="historia__volver boton-volver"
      onClick={volver}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {texto}
    </button>
  );
}

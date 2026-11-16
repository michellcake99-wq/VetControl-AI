import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { reducirImagen } from '../utils/imagen.js';
import FotoMascota from './FotoMascota.jsx';

/** Campo del formulario para elegir, cambiar o quitar la foto de la mascota. */
export default function SelectorFoto({ foto, nombre, onCambio }) {
  const entrada = useRef(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setError('');
    setProcesando(true);
    try {
      onCambio(await reducirImagen(archivo));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <span className="campo__etiqueta">Foto</span>
      <div className="selector-foto">
        <FotoMascota mascota={{ foto, nombre }} tamano={88} />
        <div className="selector-foto__acciones">
          <button
            type="button"
            className="boton boton--claro boton--peq"
            onClick={() => entrada.current?.click()}
            disabled={procesando}
          >
            <Camera size={14} />
            {procesando ? 'Procesando…' : foto ? 'Cambiar foto' : 'Elegir foto'}
          </button>
          {foto && (
            <button
              type="button"
              className="boton boton--claro boton--peq"
              onClick={() => onCambio('')}
            >
              <Trash2 size={14} />
              Quitar
            </button>
          )}
          <span className="texto-sec">JPG, PNG o WebP. Se ajusta sola.</span>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={elegir}
          aria-label="Elegir foto de la mascota"
        />
      </div>
      {error && <span className="campo__error">{error}</span>}
    </div>
  );
}

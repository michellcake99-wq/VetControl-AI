import { PawPrint } from 'lucide-react';

/** Foto de la mascota en círculo; si no tiene, muestra el ícono de huella. */
export default function FotoMascota({ mascota, tamano = 44 }) {
  const estilo = { width: tamano, height: tamano };
  if (mascota?.foto) {
    return (
      <img
        className="foto-mascota"
        src={mascota.foto}
        alt={`Foto de ${mascota.nombre}`}
        style={estilo}
      />
    );
  }
  return (
    <span
      className="foto-mascota foto-mascota--vacia"
      style={estilo}
      aria-hidden="true"
    >
      <PawPrint size={Math.round(tamano * 0.45)} strokeWidth={1.8} />
    </span>
  );
}

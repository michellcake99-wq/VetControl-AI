import { Loader2 } from 'lucide-react';

export default function CargandoInline({ texto = 'Cargando…' }) {
  return (
    <div className="cargando">
      <Loader2 size={18} className="cargando__icono" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

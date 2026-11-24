import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Campo con etiqueta, ayuda y mensaje de error. Con tipo "password" agrega el botón de mostrar/ocultar.
// `icono` (opcional): ícono de lucide que se muestra a la izquierda dentro del campo.
export default function CampoTexto({
  id,
  etiqueta,
  error,
  ayuda,
  tipo = 'text',
  icono: Icono,
  ...resto
}) {
  const [visible, setVisible] = useState(false);
  const esClave = tipo === 'password';
  const descripcion = [error && `${id}-error`, ayuda && `${id}-ayuda`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="campo">
      <label htmlFor={id} className="campo__etiqueta">
        {etiqueta}
      </label>
      <div className={`campo__control${Icono ? ' campo__control--icono' : ''}`}>
        {Icono && (
          <Icono
            className="campo__icono"
            size={20}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          name={id}
          type={esClave && visible ? 'text' : tipo}
          className={`campo__entrada${error ? ' campo__entrada--error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={descripcion || undefined}
          {...resto}
        />
        {esClave && (
          <button
            type="button"
            className="campo__ojo"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="campo__ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="campo__error">
          {error}
        </p>
      )}
    </div>
  );
}
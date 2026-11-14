const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const correoValido = (correo) => CORREO.test(correo);

/** Devuelve el mensaje de error de un campo o '' si está bien. */
export function validarCampo(campo, valor) {
  const texto = String(valor ?? '').trim();
  switch (campo) {
    case 'nombre':
    case 'apellido':
      if (!texto) return 'Este campo es obligatorio';
      if (texto.length > 80) return 'Máximo 80 caracteres';
      return '';
    case 'correo':
      if (!texto) return 'El correo es obligatorio';
      if (!correoValido(texto))
        return 'Escribe un correo válido, por ejemplo nombre@correo.com';
      return '';
    case 'contrasena':
      if (!valor) return 'La contraseña es obligatoria';
      return '';
    case 'contrasenaNueva':
      if (!valor) return 'La contraseña es obligatoria';
      if (valor.length < 8)
        return 'La contraseña debe tener mínimo 8 caracteres';
      return '';
    default:
      return '';
  }
}

// Ep3-Hu13: textos del examen clínico, en el mismo orden del formato de historia clínica

export const ORGANOS_SISTEMAS = [
  { clave: 'estado_general', etiqueta: 'Estado general y condición corporal' },
  { clave: 'hidratacion', etiqueta: 'Estado de hidratación' },
  { clave: 'tegumentario', etiqueta: 'Sistema tegumentario' },
  { clave: 'ojos', etiqueta: 'Ojos' },
  { clave: 'oidos', etiqueta: 'Oídos' },
  { clave: 'nariz', etiqueta: 'Nariz' },
  { clave: 'digestivo', etiqueta: 'Sistema digestivo' },
  { clave: 'respiratorio', etiqueta: 'S. respiratorio' },
  { clave: 'nervioso', etiqueta: 'S. nervioso' },
  { clave: 'musculoesqueletico', etiqueta: 'S. musculoesquelético' },
  { clave: 'cardiovascular', etiqueta: 'S. cardiovascular' },
  { clave: 'genitourinario', etiqueta: 'S. genitourinario' },
];

export const VALORES_ORGANO = [
  { valor: 'N', etiqueta: 'Normal' },
  { valor: 'AN', etiqueta: 'Anormal' },
  { valor: 'NE', etiqueta: 'No examinado' },
];

export const ACTITUDES = [
  { valor: 'letargico', etiqueta: 'Letárgico' },
  { valor: 'estuporoso', etiqueta: 'Estuporoso' },
  { valor: 'comatoso', etiqueta: 'Comatoso' },
  { valor: 'alerta', etiqueta: 'Alerta' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const ESTADOS_TRATAMIENTO = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'finalizado', etiqueta: 'Finalizado' },
  { valor: 'suspendido', etiqueta: 'Suspendido' },
];

/** Acepta un arreglo o una respuesta paginada { datos, meta } */
export const lista = (r) => (Array.isArray(r) ? r : (r?.datos ?? []));

// Lote C: contenido del Centro de ayuda (preguntas frecuentes y accesos rápidos según el rol)

// Datos de contacto de la clínica. Se dejan vacíos a propósito: cuando la clínica los defina,
// basta con completarlos aquí y aparecen solos en la página de ayuda.
export const CONTACTO_CLINICA = {
  correo: '',
  telefono: '',
  horario: '',
};

const TODOS = ['propietario', 'veterinario', 'administrador'];

// Accesos rápidos: "icono" es el nombre del icono de lucide-react (se resuelve en la página)
export const ACCESOS_RAPIDOS = [
  {
    to: '/citas/nueva',
    titulo: 'Pedir una cita',
    detalle: 'Agenda una consulta para tu mascota',
    icono: 'CalendarPlus',
    roles: ['propietario'],
  },
  {
    to: '/mascotas',
    titulo: 'Mis mascotas',
    detalle: 'Fichas, historia clínica y carné',
    icono: 'PawPrint',
    roles: ['propietario'],
  },
  {
    to: '/vacunas',
    titulo: 'Vacunas',
    detalle: 'Revisa lo aplicado y lo próximo',
    icono: 'Syringe',
    roles: ['propietario'],
  },
  {
    to: '/citas',
    titulo: 'Agenda de citas',
    detalle: 'Confirma, completa o cancela citas',
    icono: 'Calendar',
    roles: ['veterinario'],
  },
  {
    to: '/consultas/nueva',
    titulo: 'Registrar consulta',
    detalle: 'Anota el diagnóstico y el tratamiento',
    icono: 'ClipboardPlus',
    roles: ['veterinario'],
  },
  {
    to: '/pendientes-clinicos',
    titulo: 'Pendientes clínicos',
    detalle: 'Pacientes que requieren seguimiento',
    icono: 'ClipboardList',
    roles: ['veterinario'],
  },
  {
    to: '/propietarios',
    titulo: 'Propietarios',
    detalle: 'Consulta y registra propietarios',
    icono: 'Users',
    roles: ['administrador'],
  },
  {
    to: '/veterinarios',
    titulo: 'Veterinarios',
    detalle: 'Gestiona al equipo de la clínica',
    icono: 'Stethoscope',
    roles: ['administrador'],
  },
  {
    to: '/chat',
    titulo: 'Mensajes',
    detalle: 'Conversa por chat',
    icono: 'MessageCircle',
    roles: ['propietario', 'veterinario'],
  },
  {
    to: '/asistente',
    titulo: 'Asistente IA',
    detalle: 'Pregúntale a NubiVet',
    icono: 'Sparkles',
    roles: TODOS,
  },
  {
    to: '/perfil',
    titulo: 'Mi perfil',
    detalle: 'Tus datos y tu contraseña',
    icono: 'User',
    roles: TODOS,
  },
];

// Preguntas frecuentes. "enlace" es opcional: lleva a la sección donde se hace lo que explica la respuesta.
export const PREGUNTAS = [
  // --- Propietario ---
  {
    roles: ['propietario'],
    tema: 'Citas',
    pregunta: '¿Cómo pido una cita para mi mascota?',
    respuesta:
      'Entra a Citas y elige solicitar una cita. Selecciona la mascota, el tipo de consulta, el veterinario y un día y hora disponibles. La duración la define el tipo de consulta, así que no tienes que calcularla. La cita queda pendiente hasta que el veterinario la confirme.',
    enlace: { to: '/citas/nueva', texto: 'Pedir una cita' },
  },
  {
    roles: ['propietario'],
    tema: 'Citas',
    pregunta: '¿Puedo cancelar una cita?',
    respuesta:
      'Sí. En Citas ves todas tus citas con su estado y puedes cancelar las que aún no se han realizado.',
    enlace: { to: '/citas', texto: 'Ver mis citas' },
  },
  {
    roles: ['propietario'],
    tema: 'Mascotas',
    pregunta: '¿Cómo registro una mascota?',
    respuesta:
      'En Mis mascotas usa el botón para agregar una nueva mascota y completa sus datos. Después podrás ver su ficha, su historia clínica y su carné de vacunación.',
    enlace: { to: '/mascotas/nueva', texto: 'Registrar mascota' },
  },
  {
    roles: ['propietario'],
    tema: 'Mascotas',
    pregunta: '¿Dónde veo el carné de vacunación de mi mascota?',
    respuesta:
      'Abre la ficha de tu mascota desde Mis mascotas y entra a su carné de vacunación. También puedes revisar las vacunas de todas tus mascotas en la sección Vacunas.',
    enlace: { to: '/vacunas', texto: 'Ir a Vacunas' },
  },
  {
    roles: ['propietario'],
    tema: 'Mascotas',
    pregunta: '¿Dónde veo lo que le han hecho a mi mascota en la clínica?',
    respuesta:
      'En Historial médico encuentras en orden cronológico las consultas, los tratamientos y las vacunas de tus mascotas.',
    enlace: { to: '/historial', texto: 'Ver historial médico' },
  },
  {
    roles: ['propietario'],
    tema: 'Mensajes',
    pregunta: '¿Cómo hablo con el veterinario de mi mascota?',
    respuesta:
      'Desde Mensajes puedes escribirle directamente al veterinario para resolver dudas sobre tu mascota. Si te escribe, verás un aviso con la cantidad de mensajes sin leer.',
    enlace: { to: '/chat', texto: 'Ir a Mensajes' },
  },
  // --- Veterinario ---
  {
    roles: ['veterinario'],
    tema: 'Citas',
    pregunta: '¿Cómo gestiono las citas de mi agenda?',
    respuesta:
      'En Citas ves tu agenda. Allí puedes confirmar una cita pendiente, marcarla como completada, cancelarla o indicar que el propietario no asistió.',
    enlace: { to: '/citas', texto: 'Ir a Citas' },
  },
  {
    roles: ['veterinario'],
    tema: 'Citas',
    pregunta: '¿Cuánto dura cada cita?',
    respuesta:
      'La duración depende del tipo de consulta (por ejemplo, vacunación y desparasitación son más cortas que una cirugía). Si necesitas otra duración para un caso puntual, puedes ajustarla al gestionar la cita.',
  },
  {
    roles: ['veterinario'],
    tema: 'Consultas',
    pregunta: '¿Cómo registro una consulta?',
    respuesta:
      'Entra a Consultas y crea una nueva. Elige al paciente y completa el motivo, el diagnóstico y el tratamiento. Queda guardado en la historia clínica de la mascota.',
    enlace: { to: '/consultas/nueva', texto: 'Registrar consulta' },
  },
  {
    roles: ['veterinario', 'administrador'],
    tema: 'Seguimiento',
    pregunta: '¿Qué son los pendientes clínicos?',
    respuesta:
      'Es la lista de información clínica que requiere revisión, como vacunas vencidas, tratamientos que siguen activos aunque ya pasó su fecha de fin y pacientes sin consultas. Sirve para no dejar casos sin revisar.',
    enlace: { to: '/pendientes-clinicos', texto: 'Ver pendientes' },
  },
  {
    roles: ['veterinario'],
    tema: 'Mensajes',
    pregunta: '¿Cómo respondo a un propietario por el chat?',
    respuesta:
      'En Mensajes aparecen tus conversaciones. Las que tienen mensajes sin leer muestran un contador. Abre una para responder.',
    enlace: { to: '/chat', texto: 'Ir a Mensajes' },
  },
  // --- Administrador ---
  {
    roles: ['administrador'],
    tema: 'Gestión',
    pregunta: '¿Cómo registro a un propietario o a un veterinario?',
    respuesta:
      'En Propietarios y en Veterinarios encuentras el listado y el botón para agregar uno nuevo o editar sus datos.',
    enlace: { to: '/veterinarios', texto: 'Ir a Veterinarios' },
  },
  {
    roles: ['administrador'],
    tema: 'Gestión',
    pregunta: '¿Qué puedo consultar como administrador?',
    respuesta:
      'Puedes revisar pacientes, citas, consultas, vacunas y pendientes clínicos de toda la clínica, además de gestionar propietarios y veterinarios. El chat es solo entre propietarios y veterinarios.',
  },
  // --- Todos ---
  {
    roles: TODOS,
    tema: 'Asistente IA',
    pregunta: '¿Qué puede hacer el asistente de IA (NubiVet)?',
    respuesta:
      'Responde preguntas sobre cuidado de mascotas y sobre la información registrada en la clínica, y puede resumir una historia clínica. Es un apoyo: no reemplaza el criterio del veterinario ni da diagnósticos. Ante una emergencia, acude a la clínica.',
    enlace: { to: '/asistente', texto: 'Hablar con NubiVet' },
  },
  {
    roles: TODOS,
    tema: 'Asistente IA',
    pregunta:
      '¿Por qué el asistente me dice que llegué al límite de consultas?',
    respuesta:
      'Para cuidar el servicio, cada persona tiene un número de consultas al asistente por periodo de tiempo. En la pantalla del asistente ves cuántas te quedan y, si se agotaron, en cuántos minutos podrás consultar de nuevo.',
  },
  {
    roles: TODOS,
    tema: 'Cuenta',
    pregunta: '¿Cómo cambio mi contraseña?',
    respuesta:
      'Entra a Mi perfil y usa la sección Cambiar contraseña: escribe la actual y luego la nueva (mínimo 8 caracteres).',
    enlace: { to: '/perfil', texto: 'Ir a Mi perfil' },
  },
  {
    roles: TODOS,
    tema: 'Cuenta',
    pregunta: 'Olvidé mi contraseña, ¿qué hago?',
    respuesta:
      'En la pantalla de inicio de sesión elige "¿Olvidó su contraseña?" y sigue los pasos para recuperarla.',
  },
  {
    roles: TODOS,
    tema: 'Cuenta',
    pregunta: '¿Dónde veo mis notificaciones?',
    respuesta:
      'En Notificaciones encuentras los avisos de la plataforma, por ejemplo recordatorios de vacunas o de tratamientos.',
    enlace: { to: '/notificaciones', texto: 'Ver notificaciones' },
  },
];

/** Quita tildes y mayúsculas para comparar textos. */
export const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Preguntas del rol que contienen todas las palabras buscadas (en la pregunta, la respuesta o el tema). */
export function preguntasDelRol(rol, busqueda = '') {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  return PREGUNTAS.filter((p) => p.roles.includes(rol)).filter((p) => {
    const contenido = normalizar(`${p.tema} ${p.pregunta} ${p.respuesta}`);
    return palabras.every((palabra) => contenido.includes(palabra));
  });
}

export const accesosDelRol = (rol) =>
  ACCESOS_RAPIDOS.filter((a) => a.roles.includes(rol));

/** ¿La clínica ya definió algún dato de contacto? */
export const hayContacto = () => Object.values(CONTACTO_CLINICA).some(Boolean);

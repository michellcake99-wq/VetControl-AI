import {
  ShieldCheck,
  FileText,
  MessagesSquare,
  Sparkles,
  CalendarCheck,
  ClipboardList,
  Database,
  MessageCircle,
  BrainCircuit,
  Stethoscope,
  PawPrint,
  House,
  Calendar,
  Syringe,
  User,
  Users,
  ClipboardPlus,
  History,
  CalendarClock,
  Pill,
} from 'lucide-react';

// Secciones del menú superior (anclas dentro de la misma página).
export const secciones = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'sobre', label: 'Sobre el Proyecto' },
  { id: 'funcionalidades', label: 'Funcionalidades' },
  { id: 'demo', label: 'Demo Interactiva' },
];

export const estadisticas = [
  { valor: '100%', texto: 'Historias digitales' },
  { valor: '24/7', texto: 'Soporte IA y chat', acento: true },
];

export const pilares = [
  {
    icono: Database,
    titulo: 'Centralización Clínica',
    texto:
      'Base de datos PostgreSQL relacional con historias clínicas unificadas, vacunas, tratamientos previos y fichas completas de cada paciente.',
  },
  {
    icono: MessageCircle,
    titulo: 'Chat Propietario-Veterinario',
    texto:
      'Canal en tiempo real mediante Socket.IO donde el veterinario puede consultar la historia del paciente mientras atiende inquietudes del cliente.',
  },
  {
    icono: BrainCircuit,
    titulo: 'Asistente con IA',
    texto:
      'Modelos de lenguaje enlazados a los datos para síntesis automática de antecedentes médicos y generación de alertas preventivas.',
  },
];

// Para quién está pensada la plataforma.
export const publico = [
  {
    icono: Stethoscope,
    titulo: 'Personal veterinario',
    texto:
      'Veterinarios y auxiliares de clínicas pequeñas y medianas que registran historias, citas, vacunas y tratamientos.',
  },
  {
    icono: PawPrint,
    titulo: 'Propietarios de mascotas',
    texto:
      'Dueños que quieren seguir la salud de su mascota entre visitas, recibir recordatorios y hablar con su veterinario.',
  },
];

export const funcionalidades = [
  {
    icono: ShieldCheck,
    etiqueta: 'Roles JWT',
    titulo: 'Autenticación por Roles',
    texto:
      'Vistas y permisos diferenciados para el personal de la clínica y los propietarios de las mascotas mediante tokens seguros JWT.',
  },
  {
    icono: FileText,
    etiqueta: 'Historial Clínico',
    titulo: 'Historias Clínicas Interactivas',
    texto:
      'Registro minucioso de evoluciones, diagnósticos, recetas electrónicas y exámenes médicos con acceso instantáneo.',
  },
  {
    icono: MessagesSquare,
    etiqueta: 'Socket.IO',
    titulo: 'Chat Bidireccional',
    texto:
      'Comunicación fluida entre la clínica y los clientes, permitiendo resolver dudas sin desplazamiento innecesario.',
  },
  {
    icono: Sparkles,
    etiqueta: 'LLM Integrado',
    titulo: 'Asistente de IA Clínico',
    texto:
      'Procesa datos complejos de historias previas para sintetizar antecedentes y sugerir seguimientos pendientes.',
  },
  {
    icono: CalendarCheck,
    etiqueta: 'Agendamiento',
    titulo: 'Gestión de Citas y Vacunas',
    texto:
      'Programación automática de controles, carné de vacunación digital y recordatorios preventivos vía correo y notificaciones.',
  },
  {
    icono: ClipboardList,
    etiqueta: 'Propietarios',
    titulo: 'Seguimiento por el Dueño',
    texto:
      'El usuario puede registrar la evolución diaria de tratamientos entre visitas clínicas para mayor precisión médica.',
  },
];

// ---------------------------------------------------------------------------
// Demo interactiva: réplica del "Inicio" real de la app para cada rol.
// Menús, textos y etiquetas salen de routes.js / Sidebar.jsx / Inicio.jsx, y los
// datos de ejemplo son los de database/seed.sql (Ana Torres, Laura Quintero,
// Max, Luna, Rocky y Kiwi). Las fechas se calculan a partir de hoy ("dias").
// ---------------------------------------------------------------------------
export const demo = {
  propietario: {
    tab: 'Propietario de Mascota',
    url: 'app.vetcontrol.ai/inicio',
    portal: 'Portal de propietarios',
    etiquetaRol: 'Propietario/a',
    cuenta: { nombre: 'Ana', apellido: 'Torres' },
    menu: [
      { label: 'Inicio', icono: House },
      { label: 'Mis mascotas', icono: PawPrint },
      { label: 'Consultas', icono: ClipboardPlus },
      { label: 'Historial médico', icono: History },
      { label: 'Citas', icono: Calendar },
      { label: 'Vacunas', icono: Syringe },
      { label: 'Mensajes', icono: MessageCircle },
      { label: 'Asistente IA', icono: Sparkles },
      { label: 'Mi perfil', icono: User },
    ],
    lema: 'El cuidado de tu mascota, más inteligente y organizado.',
    subtitulo:
      'Gestiona citas, vacunas, tratamientos e historia clínica desde un solo lugar.',
    metricas: [
      {
        icono: PawPrint,
        titulo: 'Mis mascotas',
        valor: '2',
        detalle: 'registradas',
        color: 'azul',
      },
      { icono: Calendar, titulo: 'Próxima cita', cita: 0, color: 'celeste' },
      {
        icono: Pill,
        titulo: 'Tratamientos activos',
        valor: '1',
        detalle: 'en curso',
        color: 'verde',
      },
    ],
    tituloMascotas: 'Mis mascotas',
    mascotas: [
      {
        nombre: 'Max',
        sexo: 'macho',
        raza: 'Labrador',
        nacimiento: '2021-03-15',
        estados: [
          { clase: 'al-dia', texto: 'Vacunas al día' },
          { clase: 'tratamiento', texto: 'Tratamiento en curso' },
        ],
      },
      {
        nombre: 'Luna',
        sexo: 'hembra',
        raza: 'Criollo',
        nacimiento: '2023-07-01',
        estados: [
          { clase: 'al-dia', texto: 'Vacunas al día' },
          { clase: 'al-dia', texto: 'Sin tratamientos' },
        ],
      },
    ],
    citas: [
      {
        dias: 20,
        hora: '9:30 a. m.',
        mascota: 'Max',
        tipo: 'Control / seguimiento',
        con: 'Laura Quintero',
      },
    ],
    preguntas: [
      '¿Cuándo es la próxima vacuna de Max?',
      'Resume la historia clínica de Luna.',
      '¿Qué seguimientos tengo pendientes?',
    ],
  },
  veterinario: {
    tab: 'Personal Veterinario',
    url: 'app.vetcontrol.ai/inicio',
    portal: 'Portal veterinario',
    etiquetaRol: 'Veterinario/a',
    cuenta: { nombre: 'Laura', apellido: 'Quintero' },
    menu: [
      { label: 'Inicio', icono: House },
      { label: 'Pacientes', icono: PawPrint },
      { label: 'Propietarios', icono: Users },
      { label: 'Consultas', icono: ClipboardPlus },
      { label: 'Citas', icono: Calendar },
      { label: 'Vacunas', icono: Syringe },
      { label: 'Mensajes', icono: MessageCircle },
      { label: 'Asistente IA', icono: Sparkles },
      { label: 'Mi perfil', icono: User },
    ],
    lema: 'El cuidado de tus pacientes, más inteligente y organizado.',
    subtitulo:
      'Tu agenda, tus pacientes y sus historias clínicas, en un solo lugar.',
    metricas: [
      {
        icono: PawPrint,
        titulo: 'Pacientes',
        valor: '4',
        detalle: 'en la clínica',
        color: 'azul',
      },
      { icono: Calendar, titulo: 'Próxima cita', cita: 0, color: 'celeste' },
      {
        icono: CalendarClock,
        titulo: 'Citas de hoy',
        valor: '0',
        detalle: 'pendientes hoy',
        color: 'verde',
      },
    ],
    tituloMascotas: 'Pacientes',
    mascotas: [
      {
        nombre: 'Max',
        sexo: 'macho',
        raza: 'Labrador',
        nacimiento: '2021-03-15',
        dueno: 'Ana Torres',
      },
      {
        nombre: 'Luna',
        sexo: 'hembra',
        raza: 'Criollo',
        nacimiento: '2023-07-01',
        dueno: 'Ana Torres',
      },
      {
        nombre: 'Rocky',
        sexo: 'macho',
        raza: 'Bulldog',
        nacimiento: '2020-11-20',
        dueno: 'Carlos Rincón',
      },
      {
        nombre: 'Kiwi',
        sexo: 'desconocido',
        raza: 'Periquito',
        nacimiento: null,
        dueno: 'Marta Gómez',
      },
    ],
    citas: [
      {
        dias: 3,
        hora: '9:00 a. m.',
        mascota: 'Rocky',
        tipo: 'Consulta general',
        con: 'Carlos Rincón',
      },
      {
        dias: 20,
        hora: '9:30 a. m.',
        mascota: 'Max',
        tipo: 'Control / seguimiento',
        con: 'Ana Torres',
      },
    ],
    preguntas: [
      'Resume la historia clínica de un paciente.',
      '¿Qué pacientes tienen refuerzos vencidos?',
      '¿Qué seguimientos tengo pendientes esta semana?',
    ],
  },
};

// Datos del pie de página. TODO: reemplazar el correo por el oficial del equipo.
export const proyecto = {
  descripcion:
    'Plataforma web para la gestión clínica veterinaria con asistente de inteligencia artificial.',
  programa: 'Ingeniería de Software',
  universidad: 'Universidad Francisco de Paula Santander Ocaña',
  colaboracion: 'Proyecto COIL UFPSO – UIDE',
  correo: 'contacto@vetcontrol.ai',
  repositorio: 'https://github.com/michellcake99-wq/VetControl-AI',
};
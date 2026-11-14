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

// Contenido de la demo para cada rol.
export const demo = {
  veterinario: {
    tab: 'Personal Veterinario',
    url: 'app.vetcontrol.ai/vet-dashboard',
    usuario: 'Dr. Carlos Mendoza (Veterinario)',
    titulo: 'Panel Clínico de Control',
    subtitulo:
      'Gestionando paciente: Max (Propietaria: María Camila Rodríguez)',
    accion: '+ Nueva historia / evolución',
    menu: [
      'Historia Clínica',
      'Carnet de Vacunas',
      'Agendar Citas',
      'Resumen Asistente IA',
    ],
    metricas: [
      { label: 'Último peso', valor: '28.5 kg', nota: '+0.3 kg óptimo' },
      {
        label: 'Estado vacunación',
        valor: 'Al día',
        nota: '1 vacuna en 18 días',
      },
      {
        label: 'Tratamiento activo',
        valor: 'Otic Drops',
        nota: 'Día 7 de 10 completado',
      },
    ],
    registros: [
      {
        titulo: 'Control Otitis Externa',
        fecha: '12 Oct 2026',
        texto:
          'Revisión de canal auditivo. Inflamación reducida en un 80%. Continuar gotas por 3 días más.',
      },
      {
        titulo: 'Vacunación Séxtuple',
        fecha: '05 Jun 2026',
        texto: 'Aplicación exitosa sin reacción adversa registrada.',
      },
    ],
    chat: {
      titulo: 'Chat e IA integrada',
      entrante:
        '¡Hola! Soy el Asistente IA de VetControl. ¿En qué puedo ayudarte hoy con el historial de Max?',
      saliente: 'Genera un resumen de la última consulta y vacunas pendientes.',
      placeholder: 'Consulta a la IA o escribe al cliente...',
    },
  },
  propietario: {
    tab: 'Propietario de Mascota',
    url: 'app.vetcontrol.ai/mis-mascotas',
    usuario: 'María Camila Rodríguez (Propietaria)',
    titulo: 'Seguimiento de Max',
    subtitulo: 'Veterinario a cargo: Dr. Carlos Mendoza',
    accion: '+ Registrar evolución',
    menu: [
      'Historia Clínica',
      'Carnet de Vacunas',
      'Agendar Citas',
      'Chat con mi veterinario',
    ],
    metricas: [
      { label: 'Próxima cita', valor: '15 Nov', nota: 'Control · 9:30 a.m.' },
      {
        label: 'Próxima vacuna',
        valor: 'Rabia',
        nota: 'Recordatorio en 18 días',
      },
      {
        label: 'Tratamiento activo',
        valor: 'Otic Drops',
        nota: '3 dosis pendientes',
      },
    ],
    registros: [
      {
        titulo: 'Evolución registrada por ti',
        fecha: 'Hoy',
        texto:
          'Max ya no se rasca la oreja. Se aplicaron las gotas de la mañana.',
      },
      {
        titulo: 'Control Otitis Externa',
        fecha: '12 Oct 2026',
        texto: 'Indicaciones del veterinario: continuar gotas por 3 días más.',
      },
    ],
    chat: {
      titulo: 'Chat con el veterinario',
      entrante:
        'Hola María Camila, revisé la evolución de Max. Va muy bien, terminen el tratamiento.',
      saliente: '¡Gracias doctor! ¿Debo llevarlo al control del 15?',
      placeholder: 'Escribe a tu veterinario...',
    },
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

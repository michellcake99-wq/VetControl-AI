import {
  House,
  PawPrint,
  Calendar,
  Syringe,
  MessageCircle,
  Sparkles,
  User,
  Users,
  Stethoscope,
  ClipboardPlus,
  History,
  ClipboardList,
} from 'lucide-react';

// Ep7-Hu1: cada opción del menú indica qué roles la ven
export const TODOS_LOS_ROLES = ['propietario', 'veterinario', 'administrador'];
export const PERSONAL_CLINICA = ['veterinario', 'administrador'];
// El chat (Ep8) es solo entre propietario y veterinario
export const ROLES_CHAT = ['propietario', 'veterinario'];

export const navItems = [
  { to: '/inicio', label: 'Inicio', icon: House, roles: TODOS_LOS_ROLES },
  {
    to: '/mascotas',
    label: 'Mis mascotas',
    // Para el personal de la clínica las mascotas son sus pacientes
    etiquetas: { veterinario: 'Pacientes', administrador: 'Pacientes' },
    icon: PawPrint,
    roles: TODOS_LOS_ROLES,
  },
  // Ep3-Hu11: el personal de la clínica también ve el listado de propietarios
  {
    to: '/propietarios',
    label: 'Propietarios',
    icon: Users,
    roles: PERSONAL_CLINICA,
  },
  // Ep6-Hu3: pendientes clínicos globales (solo veterinario y administrador)
  {
    to: '/pendientes-clinicos',
    label: 'Pendientes clínicos',
    icon: ClipboardList,
    roles: PERSONAL_CLINICA,
  },
  // Ep3-Hu13: consultas (el veterinario registra; propietario y administrador consultan)
  {
    to: '/consultas',
    label: 'Consultas',
    icon: ClipboardPlus,
    roles: TODOS_LOS_ROLES,
  },
  // Ep4-Hu2: el propietario revisa el historial médico de sus mascotas
  {
    to: '/historial',
    label: 'Historial médico',
    icon: History,
    roles: ['propietario'],
  },
  { to: '/citas', label: 'Citas', icon: Calendar, roles: TODOS_LOS_ROLES },
  { to: '/vacunas', label: 'Vacunas', icon: Syringe, roles: TODOS_LOS_ROLES },
  { to: '/chat', label: 'Mensajes', icon: MessageCircle, roles: ROLES_CHAT },
  {
    to: '/asistente',
    label: 'Asistente IA',
    icon: Sparkles,
    roles: TODOS_LOS_ROLES,
  },
  { to: '/perfil', label: 'Mi perfil', icon: User, roles: TODOS_LOS_ROLES },
  // Ep4-Hu5: solo el administrador gestiona veterinarios
  {
    to: '/veterinarios',
    label: 'Veterinarios',
    icon: Stethoscope,
    roles: ['administrador'],
  },
];
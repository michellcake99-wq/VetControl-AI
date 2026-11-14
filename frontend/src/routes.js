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

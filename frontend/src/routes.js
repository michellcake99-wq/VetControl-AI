import {
  House,
  PawPrint,
  Calendar,
  Syringe,
  Sparkles,
  User,
} from 'lucide-react';

export const navItems = [
  { to: '/inicio', label: 'Inicio', icon: House },
  { to: '/mascotas', label: 'Mis mascotas', icon: PawPrint },
  { to: '/citas', label: 'Citas', icon: Calendar },
  { to: '/vacunas', label: 'Vacunas', icon: Syringe },
  { to: '/asistente', label: 'Asistente IA', icon: Sparkles },
  { to: '/perfil', label: 'Mi perfil', icon: User },
];

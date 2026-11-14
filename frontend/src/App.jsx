import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import PaginaPublica from './pages/PaginaPublica.jsx';
import Inicio from './pages/Inicio.jsx';
import EnConstruccion from './pages/EnConstruccion.jsx';
import IniciarSesion from './pages/IniciarSesion.jsx';
import Registro from './pages/Registro.jsx';
import RecuperarContrasena from './pages/RecuperarContrasena.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Chat from './pages/Chat.jsx';
import AccesoDenegado from './pages/AccesoDenegado.jsx';
import Mascotas from './pages/Mascotas.jsx';
import MascotaFormulario from './pages/MascotaFormulario.jsx';
import Propietarios from './pages/Propietarios.jsx';
import PropietarioFormulario from './pages/PropietarioFormulario.jsx';
import Veterinarios from './pages/Veterinarios.jsx';
import VeterinarioFormulario from './pages/VeterinarioFormulario.jsx';
import { PERSONAL_CLINICA, ROLES_CHAT } from './routes.js';

// Ep7-Hu1: envuelve una pantalla para que solo la vean ciertos roles
const soloPara = (roles, pantalla) => (
  <RutaProtegida roles={roles}>{pantalla}</RutaProtegida>
);
const SOLO_ADMIN = ['administrador'];

export default function App() {
  return (
    <Routes>
      {/* Página principal pública */}
      <Route index element={<PaginaPublica />} />
      <Route path="/iniciar-sesion" element={<IniciarSesion />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />

      {/* Todo lo de adentro exige sesión iniciada */}
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/acceso-denegado" element={<AccesoDenegado />} />

        {/* Ep3-Hu11: mascotas (el propietario solo ve y edita las suyas) */}
        <Route path="/mascotas" element={<Mascotas />} />
        <Route path="/mascotas/nueva" element={<MascotaFormulario />} />
        <Route path="/mascotas/:id/editar" element={<MascotaFormulario />} />

        {/* Ep3-Hu11: propietarios (solo personal de la clínica) */}
        <Route
          path="/propietarios"
          element={soloPara(PERSONAL_CLINICA, <Propietarios />)}
        />
        <Route
          path="/propietarios/nuevo"
          element={soloPara(PERSONAL_CLINICA, <PropietarioFormulario />)}
        />

        {/* Ep4-Hu5: veterinarios (solo administrador) */}
        <Route
          path="/veterinarios"
          element={soloPara(SOLO_ADMIN, <Veterinarios />)}
        />
        <Route
          path="/veterinarios/nuevo"
          element={soloPara(SOLO_ADMIN, <VeterinarioFormulario />)}
        />
        <Route
          path="/veterinarios/:id/editar"
          element={soloPara(SOLO_ADMIN, <VeterinarioFormulario />)}
        />

        <Route path="/citas" element={<EnConstruccion titulo="Citas" />} />
        <Route
          path="/citas/nueva"
          element={<EnConstruccion titulo="Agendar una cita" />}
        />
        <Route path="/vacunas" element={<EnConstruccion titulo="Vacunas" />} />
        {/* Ep8: el chat es solo entre propietario y veterinario */}
        <Route path="/chat" element={soloPara(ROLES_CHAT, <Chat />)} />
        <Route
          path="/asistente"
          element={<EnConstruccion titulo="Asistente IA" />}
        />
        <Route path="/perfil" element={<EnConstruccion titulo="Mi perfil" />} />
        <Route path="/ayuda" element={<EnConstruccion titulo="Ayuda" />} />
        <Route
          path="/notificaciones"
          element={<EnConstruccion titulo="Notificaciones" />}
        />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Route>
    </Routes>
  );
}

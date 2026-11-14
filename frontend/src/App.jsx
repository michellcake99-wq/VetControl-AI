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

export default function App() {
  return (
    <Routes>
      {/* Página principal pública */}
      <Route index element={<PaginaPublica />} />
      <Route path="/iniciar-sesion" element={<IniciarSesion />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route path="/inicio" element={<Inicio />} />
        <Route
          path="/mascotas"
          element={<EnConstruccion titulo="Mis mascotas" />}
        />
        <Route
          path="/mascotas/nueva"
          element={<EnConstruccion titulo="Registrar mascota" />}
        />
        <Route path="/citas" element={<EnConstruccion titulo="Citas" />} />
        <Route
          path="/citas/nueva"
          element={<EnConstruccion titulo="Agendar una cita" />}
        />
        <Route path="/vacunas" element={<EnConstruccion titulo="Vacunas" />} />
        <Route path="/chat" element={<Chat />} />
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

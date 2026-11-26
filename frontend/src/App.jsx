import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import PaginaPublica from './pages/PaginaPublica.jsx';
import Inicio from './pages/Inicio.jsx';
import PendientesClinicos from './pages/PendientesClinicos.jsx';
import EnConstruccion from './pages/EnConstruccion.jsx';
import MiPerfil from './pages/MiPerfil.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import IniciarSesion from './pages/IniciarSesion.jsx';
import Registro from './pages/Registro.jsx';
import RecuperarContrasena from './pages/RecuperarContrasena.jsx';
import RestablecerContrasena from './pages/RestablecerContrasena.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Chat from './pages/Chat.jsx';
import AccesoDenegado from './pages/AccesoDenegado.jsx';
import Mascotas from './pages/Mascotas.jsx';
import MascotaFormulario from './pages/MascotaFormulario.jsx';
import HistoriaClinica from './pages/HistoriaClinica.jsx';
import HistorialMedico from './pages/HistorialMedico.jsx';
import Asistente from './pages/Asistente.jsx';
import Vacunas from './pages/Vacunas.jsx';
import Consultas from './pages/Consultas.jsx';
import ConsultaFormulario from './pages/ConsultaFormulario.jsx';
import HojaConsulta from './pages/HojaConsulta.jsx';
import Citas from './pages/Citas.jsx';
import CarneVacunacion from './pages/CarneVacunacion.jsx';
import DetalleMascota from './pages/DetalleMascota.jsx';
import SeguimientoMascota from './pages/SeguimientoMascota.jsx';
import CitaFormulario from './pages/CitaFormulario.jsx';
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
const SOLO_VETERINARIO = ['veterinario'];

export default function App() {
  return (
    <Routes>
      {/* Página principal pública */}
      <Route index element={<PaginaPublica />} />
      <Route path="/iniciar-sesion" element={<IniciarSesion />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route
        path="/restablecer-contrasena"
        element={<RestablecerContrasena />}
      />

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
        {/* Ep6-Hu3: información clínica pendiente para el personal veterinario */}
        <Route
          path="/pendientes-clinicos"
          element={soloPara(PERSONAL_CLINICA, <PendientesClinicos />)}
        />

        {/* Ep3-Hu11: mascotas (el propietario solo ve y edita las suyas) */}
        <Route path="/mascotas" element={<Mascotas />} />
        <Route path="/mascotas/nueva" element={<MascotaFormulario />} />
        <Route path="/mascotas/:id/editar" element={<MascotaFormulario />} />
        {/* Ficha de la mascota: historia clínica, vacunas y tratamientos en pestañas */}
        <Route path="/mascotas/:id" element={<DetalleMascota />} />
        {/* Ep3-Hu12: historia clínica (el propietario solo ve las de sus mascotas) */}
        <Route path="/mascotas/:id/historia" element={<HistoriaClinica />} />
        {/* Carné de vacunación en PDF (todos los roles) */}
        <Route path="/mascotas/:id/carne" element={<CarneVacunacion />} />
        {/* Ep4-Hu3: seguimiento de la evolución (peso y observaciones) de la mascota */}
        <Route
          path="/mascotas/:id/seguimiento"
          element={<SeguimientoMascota />}
        />

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

        {/* Ep3-Hu14: citas (propietario solicita; veterinario gestiona su agenda) */}
        <Route path="/citas" element={<Citas />} />
        <Route path="/citas/nueva" element={<CitaFormulario />} />
        {/* Ep3-Hu13: consultas (registrar/editar solo el veterinario) */}
        <Route path="/consultas" element={<Consultas />} />
        <Route
          path="/consultas/nueva"
          element={soloPara(SOLO_VETERINARIO, <ConsultaFormulario />)}
        />
        <Route path="/consultas/:id" element={<HojaConsulta />} />
        <Route
          path="/consultas/:id/editar"
          element={soloPara(SOLO_VETERINARIO, <ConsultaFormulario />)}
        />
        {/* Ep4-Hu2: historial médico cronológico (consultas, tratamientos y vacunas) */}
        <Route path="/historial" element={<HistorialMedico />} />
        {/* Ep4-Hu1: acceso al carné de vacunación de cada mascota */}
        <Route path="/vacunas" element={<Vacunas />} />
        {/* Ep8: el chat es solo entre propietario y veterinario */}
        <Route path="/chat" element={soloPara(ROLES_CHAT, <Chat />)} />
        {/* Ep6-Hu5: interfaz del asistente de inteligencia artificial */}
        <Route path="/asistente" element={<Asistente />} />
        <Route path="/perfil" element={<MiPerfil />} />
        <Route path="/ayuda" element={<EnConstruccion titulo="Ayuda" />} />
        {/* Ep5-Hu1: notificaciones y recordatorios */}
        <Route path="/notificaciones" element={<Notificaciones />} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Route>
    </Routes>
  );
}
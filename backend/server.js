require('dotenv').config({ quiet: true });
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const propietariosRoutes = require('./routes/propietarios');
const mascotasRoutes = require('./routes/mascotas');
const veterinariosRoutes = require('./routes/veterinarios');
const perfilRoutes = require('./routes/perfil');
const iaRoutes = require('./routes/ia');
const manejoErrores = require('./middleware/manejoErrores');
const { historias, consultas, tratamientos, vacunas } = require('./routes/historias');
const citasRoutes = require('./routes/citas');
const conversacionesRoutes = require('./routes/conversaciones');
const notificacionesRoutes = require('./routes/notificaciones');
const { iniciarPlanificador } = require('./utils/planificador');
const { iniciarChat } = require('./sockets/chat');
const seguridad = require('./middleware/seguridad');

const app = express();
const PORT = process.env.PORT || 3000;

// Ep7-Hu2: protección en tránsito (HTTPS en producción, CORS limitado al frontend, cabeceras de seguridad).
// Va primero para que también cubra los errores y las rutas inexistentes.
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1); // detrás del proxy de la nube
app.use(seguridad.middlewares);

// Permitir que Express reciba datos JSON
// 1 MB alcanza para la foto de una mascota (llega ya reducida desde el navegador)
app.use(express.json({ limit: '1mb' }));

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Ep4-Hu4: Mi perfil (va antes de las rutas protegidas de prueba)
app.use('/api/perfil', perfilRoutes);

// Rutas protegidas
app.use('/api', protectedRoutes);

// Hu4: propietarios y mascotas
app.use('/api/propietarios', propietariosRoutes);
app.use('/api/mascotas', mascotasRoutes);

// Ep4-Hu5: veterinarios (solo administrador)
app.use('/api/veterinarios', veterinariosRoutes);

// Hu8: historias clínicas
app.use('/api/historias', historias);
app.use('/api/consultas', consultas);
app.use('/api/tratamientos', tratamientos);
// Ep4-Hu1: catálogo de vacunas y corrección de registros
app.use('/api/vacunas', vacunas);
// Ep6-Hu1: asistente de inteligencia artificial
app.use('/api/ia', iaRoutes);

// Hu10: citas veterinarias
app.use('/api/citas', citasRoutes);

// Ep5-Hu1: notificaciones y recordatorios (campana)
app.use('/api/notificaciones', notificacionesRoutes);

// Ep8: chat propietario <-> veterinario (el tiempo real va por Socket.IO)
app.use('/api/conversaciones', conversacionesRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        mensaje: 'Servidor de VetControl AI funcionando'
    });
});

// Rutas inexistentes y manejo centralizado de errores (deben ir al final)
app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));
app.use(manejoErrores);

// Iniciar servidor (no se inicia cuando lo importan las pruebas)
if (require.main === module) {
    seguridad.verificarConfiguracion(); // en producción exige JWT_SECRET seguro y FRONTEND_URL con https
    // Express y Socket.IO comparten el mismo servidor HTTP
    const servidor = http.createServer(app);
    const io = new Server(servidor, { cors: { origin: seguridad.origenSocket } });
    app.set('io', io); // Ep8-Hu4: permite avisar en tiempo real cuando cambia un horario
    iniciarChat(io);
    // Envía los recordatorios cuando les llega la hora
    iniciarPlanificador();
    servidor.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}

module.exports = app;
require('dotenv').config({ quiet: true });
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const propietariosRoutes = require('./routes/propietarios');
const mascotasRoutes = require('./routes/mascotas');
const veterinariosRoutes = require('./routes/veterinarios');
const iaRoutes = require('./routes/ia');
const manejoErrores = require('./middleware/manejoErrores');
const { historias, consultas, tratamientos, vacunas } = require('./routes/historias');
const citasRoutes = require('./routes/citas');
const conversacionesRoutes = require('./routes/conversaciones');
const { iniciarChat } = require('./sockets/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir que Express reciba datos JSON
// 1 MB alcanza para la foto de una mascota (llega ya reducida desde el navegador)
app.use(express.json({ limit: '1mb' }));

// Rutas de autenticación
app.use('/api/auth', authRoutes);

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
    // Express y Socket.IO comparten el mismo servidor HTTP
    const servidor = http.createServer(app);
    iniciarChat(new Server(servidor));
    servidor.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}

module.exports = app;

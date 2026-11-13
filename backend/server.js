require('dotenv').config({ quiet: true });
const express = require('express');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const propietariosRoutes = require('./routes/propietarios');
const mascotasRoutes = require('./routes/mascotas');
const manejoErrores = require('./middleware/manejoErrores');
const { historias, consultas, tratamientos } = require('./routes/historias');
const citasRoutes = require('./routes/citas');

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir que Express reciba datos JSON
app.use(express.json());

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas protegidas
app.use('/api', protectedRoutes);

// Hu4: propietarios y mascotas
app.use('/api/propietarios', propietariosRoutes);
app.use('/api/mascotas', mascotasRoutes);


// Hu8: historias clínicas
app.use('/api/historias', historias);
app.use('/api/consultas', consultas);
app.use('/api/tratamientos', tratamientos);

// Hu10: citas veterinarias
app.use('/api/citas', citasRoutes);

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
    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}

module.exports = app;

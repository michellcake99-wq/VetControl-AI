const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const { cargarPerfil, permitirRoles } = require('../middleware/cargarPerfil');
const validar = require('../middleware/validar');
const esquemas = require('../validators/esquemas');
const h = require('../controllers/historiasController');

const id = validar(esquemas.parametroId, 'params');
const veterinario = permitirRoles('veterinario');

// /api/historias
const historias = express.Router();
historias.use(verificarToken, cargarPerfil);
historias.get('/:id', id, h.obtener);
historias.put('/:id', veterinario, id, validar(esquemas.historiaActualizar), h.actualizar);
historias.get('/:id/consultas', id, h.listarConsultas);
historias.post('/:id/consultas', veterinario, id, validar(esquemas.consultaCrear), h.crearConsulta);
historias.get('/:id/tratamientos', id, h.listarTratamientos);
historias.get('/:id/vacunas', id, h.listarVacunas);
historias.post('/:id/vacunas', veterinario, id, validar(esquemas.vacunaCrear), h.crearVacuna);

// /api/consultas
const consultas = express.Router();
consultas.use(verificarToken, cargarPerfil);
consultas.get('/', h.listarTodasConsultas); // Ep3-Hu13: módulo de consultas
consultas.get('/:id', id, h.obtenerConsulta);
consultas.put('/:id', veterinario, id, validar(esquemas.consultaActualizar), h.actualizarConsulta);
consultas.post('/:id/tratamientos', veterinario, id, validar(esquemas.tratamientoCrear), h.crearTratamiento);

// /api/tratamientos
const tratamientos = express.Router();
tratamientos.use(verificarToken, cargarPerfil);
tratamientos.put('/:id', veterinario, id, validar(esquemas.tratamientoActualizar), h.actualizarTratamiento);
tratamientos.get('/:id/evoluciones', id, h.listarEvoluciones);
tratamientos.post('/:id/evoluciones', permitirRoles('propietario'), id, validar(esquemas.evolucionCrear), h.crearEvolucion);

// /api/vacunas   (Ep4-Hu1)
const vacunas = express.Router();
vacunas.use(verificarToken, cargarPerfil);
vacunas.get('/catalogo', h.listarCatalogo);
vacunas.put('/:id', veterinario, id, validar(esquemas.vacunaActualizar), h.actualizarVacuna);

module.exports = { historias, consultas, tratamientos, vacunas };
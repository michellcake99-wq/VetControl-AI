const { query } = require('./baseDatos');
const { noEncontrado, sinPermiso } = require('./errores');

// Roles con acceso a la información de todas las mascotas
const PERSONAL = ['veterinario', 'administrador'];
const esPersonal = (usuario) => PERSONAL.includes(usuario.rol);

/** Mascota visible para el usuario: personal = todas; propietario = solo las suyas. */
async function obtenerMascotaAutorizada(idMascota, usuario) {
    const { rows } = await query('SELECT * FROM mascotas WHERE id_mascota = $1', [idMascota]);
    const mascota = rows[0];
    if (!mascota) throw noEncontrado('Mascota');
    if (!esPersonal(usuario) && mascota.id_propietario !== usuario.id_propietario) throw sinPermiso();
    return mascota;
}

/** Igual que la anterior pero partiendo de la historia clínica. */
async function obtenerHistoriaAutorizada(idHistoria, usuario) {
    const { rows } = await query(
        `SELECT h.*, m.id_propietario FROM historias_clinicas h
           JOIN mascotas m ON m.id_mascota = h.id_mascota WHERE h.id_historia = $1`,
        [idHistoria]
    );
    const historia = rows[0];
    if (!historia) throw noEncontrado('Historia clínica');
    if (!esPersonal(usuario) && historia.id_propietario !== usuario.id_propietario) throw sinPermiso();
    return historia;
}

module.exports = { PERSONAL, esPersonal, obtenerMascotaAutorizada, obtenerHistoriaAutorizada };

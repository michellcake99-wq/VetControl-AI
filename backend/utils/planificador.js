// Cada minuto: genera los recordatorios de tratamientos que les toca y envía los que ya llegaron a su hora (Ep5).
const { procesarPendientes, generarRecordatoriosTratamientos } = require('./notificaciones');

const CADA_MS = 60 * 1000;

function iniciarPlanificador() {
    const ciclo = () => generarRecordatoriosTratamientos().then(procesarPendientes).catch((e) => console.error('Planificador:', e.message));
    ciclo();
    return setInterval(ciclo, CADA_MS).unref();
}

module.exports = { iniciarPlanificador };
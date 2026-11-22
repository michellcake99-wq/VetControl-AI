// Revisa cada minuto si hay recordatorios por enviar (Ep5-Hu1/2/3).
const { procesarPendientes } = require('./notificaciones');

const CADA_MS = 60 * 1000;

function iniciarPlanificador() {
    const ciclo = () => procesarPendientes().catch((e) => console.error('Planificador:', e.message));
    ciclo();
    return setInterval(ciclo, CADA_MS).unref();
}

module.exports = { iniciarPlanificador };

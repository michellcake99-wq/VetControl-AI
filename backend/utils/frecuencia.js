// Ep5-Hu3: la frecuencia de un tratamiento se escribe en texto libre («cada 8 horas», «2 veces al día»,
// «diaria»...). Esta función la convierte en horas entre dosis para poder programar los recordatorios.
const NUMEROS = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };

const aNumero = (t) => (/^\d+$/.test(t) ? Number(t) : NUMEROS[t]);

/**
 * Devuelve las horas entre dosis (entre 1 y 168) o null si no se entiende.
 *  «cada 8 horas» -> 8 · «cada 2 días» -> 48 · «3 veces al día» -> 8 · «diaria» / «una vez al día» -> 24
 *  «semanal» / «cada semana» -> 168
 */
function horasEntreDosis(frecuencia) {
    const t = String(frecuencia ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();

    let m = t.match(/cada\s+(\d+|[a-z]+)\s*(h|hr|hrs|hora|horas|dia|dias|semana|semanas)\b/);
    if (m && aNumero(m[1])) {
        const n = aNumero(m[1]);
        const unidad = m[2].startsWith('h') ? 1 : m[2].startsWith('d') ? 24 : 168;
        return limitar(n * unidad);
    }
    m = t.match(/(\d+|[a-z]+)\s+veces?\s+(?:al|por|cada|en el)\s+(dia|semana)/);
    if (m && aNumero(m[1])) {
        const periodo = m[2] === 'dia' ? 24 : 168;
        return limitar(periodo / aNumero(m[1]));
    }
    if (/\b(cada\s+(dia|semana)|diari[oa]s?|una vez al dia|una vez por dia|semanal(es)?)\b/.test(t)) {
        return /semana/.test(t) ? 168 : 24;
    }
    return null;
}

const limitar = (h) => (h >= 1 && h <= 168 ? Math.round(h * 100) / 100 : null);

module.exports = { horasEntreDosis };

const { AsyncLocalStorage } = require('node:async_hooks');
const { types } = require('pg');
const pool = require('../db');

// Guarda el usuario de la petición actual para que los triggers de auditoría
// sepan quién hizo cada cambio (lo llena middleware/cargarPerfil.js).
const contextoUsuario = new AsyncLocalStorage();

/** Pasa el usuario de la aplicación a PostgreSQL (válido solo dentro de la transacción). */
async function marcarUsuario(cliente) {
    const idUsuario = contextoUsuario.getStore()?.id_usuario;
    if (idUsuario) await cliente.query("SELECT set_config('app.id_usuario', $1, true)", [String(idUsuario)]);
}

// DATE -> 'AAAA-MM-DD' (evita corrimientos por zona horaria); NUMERIC -> number
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

/**
 * Ejecuta una consulta. Las lecturas van directo al pool; las escrituras se hacen
 * en una transacción corta que primero identifica al usuario (para la auditoría).
 */
async function query(texto, parametros) {
    const esLectura = /^\s*SELECT/i.test(texto);
    if (esLectura || !contextoUsuario.getStore()) return pool.query(texto, parametros);
    return enTransaccion((cliente) => cliente.query(texto, parametros));
}

/** Ejecuta fn(cliente) dentro de una transacción (BEGIN / COMMIT / ROLLBACK). */
async function enTransaccion(fn) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        await marcarUsuario(cliente);
        const resultado = await fn(cliente);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
}

// Ep7-Hu2: los valores siempre viajan como parámetros ($1, $2…). Los nombres de tabla y columna no
// pueden ser parámetros, así que se validan: solo letras minúsculas, números y guion bajo.
function identificador(nombre) {
    if (!/^[a-z_][a-z0-9_]*$/.test(nombre)) throw new Error(`Identificador SQL no permitido: ${nombre}`);
    return nombre;
}
const listaIdentificadores = (lista) => (lista === '*' ? '*' : lista.split(',').map((c) => identificador(c.trim())).join(', '));

/** INSERT con las columnas del objeto recibido. */
function construirInsert(tabla, datos, retorno = '*') {
    const columnas = Object.keys(datos).map(identificador);
    return {
        text: `INSERT INTO ${identificador(tabla)} (${columnas.join(', ')})
               VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${listaIdentificadores(retorno)}`,
        values: Object.values(datos),
    };
}

/** UPDATE solo con los campos recibidos. */
function construirUpdate(tabla, columnaId, id, campos) {
    const columnas = Object.keys(campos).map(identificador);
    return {
        text: `UPDATE ${identificador(tabla)} SET ${columnas.map((c, i) => `${c} = $${i + 1}`).join(', ')}
               WHERE ${identificador(columnaId)} = $${columnas.length + 1} RETURNING *`,
        values: [...Object.values(campos), id],
    };
}

module.exports = { pool, query, enTransaccion, construirInsert, construirUpdate, contextoUsuario };

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');
const pool = require('../db');

const leer = (archivo) => fs.readFileSync(path.join(__dirname, '../../database', archivo), 'utf8');

async function reiniciarBase() {
    if (!/test/.test(process.env.DB_NAME)) throw new Error('Las pruebas solo se ejecutan sobre una base *_test');
    await pool.query('SET client_min_messages TO WARNING');
    await pool.query(leer('schema.sql'));
    await pool.query(leer('seed.sql'));
}

async function iniciarSesion(correo, contrasena = 'Vet12345') {
    const res = await request(app).post('/api/auth/login').send({ correo, contrasena });
    return res.body.token;
}

const api = (token) => ({
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

module.exports = { app, pool, request, reiniciarBase, iniciarSesion, api };
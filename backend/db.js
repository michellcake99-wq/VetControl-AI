const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

// Los datos de conexión se leen del archivo .env (que no se sube a GitHub).
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vetcontrol_ai',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
});

module.exports = pool;

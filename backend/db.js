const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

// Los datos de conexión se leen del archivo .env (que no se sube a GitHub).
// DB_SSL=true es obligatorio para Supabase (y la mayoría de bases en la nube);
// se deja en false por defecto para seguir funcionando con Postgres local.
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vetcontrol_ai',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

module.exports = pool;

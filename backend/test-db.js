const pool = require('./db');

pool.query('SELECT NOW()', (error, result) => {
    if (error) {
    console.error('Error de conexión:', error);
    } else {
    console.log('Conexión exitosa:', result.rows[0]);
    }

    pool.end();
});
// Las pruebas usan una base SEPARADA (se borra y se recrea en cada ejecución)
process.env.DB_NAME = process.env.DB_NAME_TEST || 'vetcontrol_ai_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas';

function paginar(req) {
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 100);
    return { pagina, limite, offset: (pagina - 1) * limite };
}

function respuestaPaginada(filas, total, { pagina, limite }) {
    return { datos: filas, meta: { pagina, limite, total, total_paginas: Math.ceil(total / limite) } };
}

module.exports = { paginar, respuestaPaginada };

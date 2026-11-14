import { useState } from 'react';
import { demo } from '../../data/paginaPublica.js';

const ROLES = ['veterinario', 'propietario'];

// Vista de muestra (no conectada al backend) que alterna entre roles.
export default function Demo() {
  const [rol, setRol] = useState('veterinario');
  const d = demo[rol];
  const mascota = rol === 'veterinario' ? 'MASCOTA SELECCIONADA' : 'MI MASCOTA';

  return (
    <>
      <div className="lp-demo__selector" role="tablist" aria-label="Vista">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            id={`tab-${r}`}
            aria-selected={rol === r}
            aria-controls="demo-panel"
            className={rol === r ? 'is-activo' : undefined}
            onClick={() => setRol(r)}
          >
            {demo[r].tab}
          </button>
        ))}
      </div>

      <div
        className="lp-demo__ventana"
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`tab-${rol}`}
      >
        <div className="lp-demo__barra">
          <span className="lp-demo__puntos" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="lp-demo__url">{d.url}</span>
          <span className="lp-demo__token">Token JWT activo</span>
          <span className="lp-demo__usuario">{d.usuario}</span>
        </div>

        <div className="lp-demo__cuerpo">
          <aside className="lp-demo__lateral">
            <p className="lp-demo__rotulo">{mascota}</p>
            <div className="lp-demo__mascota">
              <span className="lp-demo__avatar">M</span>
              <span>
                <strong>Max</strong>
                <small>Golden Retriever • 3 años</small>
              </span>
            </div>
            <ul className="lp-demo__menu">
              {d.menu.map((m, i) => (
                <li key={m} className={i === 0 ? 'is-activo' : undefined}>
                  {m}
                </li>
              ))}
            </ul>
            <p className="lp-demo__estado">
              Estado del servidor: PostgreSQL OK
              <br />
              Socket.IO: Conectado
            </p>
          </aside>

          <div className="lp-demo__panel">
            <div className="lp-demo__cabecera">
              <div>
                <h3>{d.titulo}</h3>
                <p>{d.subtitulo}</p>
              </div>
              <span className="lp-demo__accion">{d.accion}</span>
            </div>

            <div className="lp-demo__metricas">
              {d.metricas.map((m) => (
                <div key={m.label} className="lp-demo__metrica">
                  <span>{m.label}</span>
                  <strong>{m.valor}</strong>
                  <em>{m.nota}</em>
                </div>
              ))}
            </div>

            <div className="lp-demo__paneles">
              <div className="lp-demo__historial">
                <div className="lp-demo__fila">
                  <strong>Histórico registrado</strong>
                  <span>3 registros</span>
                </div>
                {d.registros.map((r) => (
                  <div key={r.titulo} className="lp-demo__registro">
                    <div className="lp-demo__fila">
                      <strong>{r.titulo}</strong>
                      <span>{r.fecha}</span>
                    </div>
                    <p>{r.texto}</p>
                  </div>
                ))}
              </div>

              <div className="lp-demo__chat">
                <div className="lp-demo__fila">
                  <strong>{d.chat.titulo}</strong>
                  <i className="lp-demo__online" aria-label="En línea" />
                </div>
                <p className="lp-demo__burbuja">{d.chat.entrante}</p>
                <p className="lp-demo__burbuja lp-demo__burbuja--propia">
                  {d.chat.saliente}
                </p>
                <div className="lp-demo__entrada" aria-hidden="true">
                  <span>{d.chat.placeholder}</span>
                  <b>→</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

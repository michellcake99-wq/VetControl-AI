import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bot,
  Calendar,
  ChevronRight,
  HeartPulse,
  LogOut,
  PawPrint,
  Plus,
  Search,
  User,
} from 'lucide-react';
import { demo } from '../../data/paginaPublica.js';
import { fechaLarga, iniciales } from '../../utils/format.js';
import { calcularEdad } from '../../utils/mascotas.js';
import FotoMascota from '../FotoMascota.jsx';
import emblema from '../../assets/logo-emblema.png';

const ROLES = ['veterinario', 'propietario'];

const SIMBOLO_SEXO = {
  macho: { simbolo: '♂', clase: 'macho', texto: 'Macho' },
  hembra: { simbolo: '♀', clase: 'hembra', texto: 'Hembra' },
};

// Las citas de ejemplo se definen "en N días" para que la demo nunca quede con fechas vencidas.
const enDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const partesFecha = (n) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
      .formatToParts(enDias(n))
      .map((x) => [x.type, x.value.replace('.', '')])
  );
  return {
    semana: p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1),
    dia: p.day,
    mes: p.month.slice(0, 3),
  };
};

function Metrica({ m, citas }) {
  const Icono = m.icono;
  let valor = m.valor;
  let detalle = m.detalle;
  if (m.cita !== undefined) {
    const c = citas[m.cita];
    const f = partesFecha(c.dias);
    valor = `${f.semana}, ${f.dia} ${f.mes}`;
    detalle = `${c.hora} · ${c.mascota}`;
  }
  return (
    <div className={`lp-app-metrica lp-app-metrica--${m.color}`}>
      <span className="lp-app-metrica__icono" aria-hidden="true">
        <Icono size={20} strokeWidth={1.9} />
      </span>
      <span className="lp-app-metrica__texto">
        <span className="lp-app-metrica__titulo">{m.titulo}</span>
        <strong>{valor}</strong>
        <span className="lp-app-metrica__detalle">{detalle}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </div>
  );
}

function MiniTarjeta({ mascota }) {
  const sexo = SIMBOLO_SEXO[mascota.sexo];
  return (
    <li className="lp-app-mini">
      <span className="lp-app-mini__cabecera">
        <FotoMascota mascota={mascota} tamano={52} />
        <span className="lp-app-mini__nombre">
          <strong>
            {mascota.nombre}
            {sexo && (
              <span
                className={`lp-app-sexo lp-app-sexo--${sexo.clase}`}
                title={sexo.texto}
              >
                {sexo.simbolo}
              </span>
            )}
          </strong>
          <span>
            {mascota.raza}
            {mascota.nacimiento && ` · ${calcularEdad(mascota.nacimiento)}`}
          </span>
        </span>
      </span>

      {mascota.estados ? (
        <span className="lp-app-mini__estados">
          {mascota.estados.map((e) => (
            <span key={e.texto} className={`lp-app-punto lp-app-punto--${e.clase}`}>
              {e.texto}
            </span>
          ))}
        </span>
      ) : (
        <span className="lp-app-mini__dueno">
          <User size={13} aria-hidden="true" />
          {mascota.dueno}
        </span>
      )}

      <span className="lp-app-mini__ver">
        Ver ficha <ArrowRight size={13} aria-hidden="true" />
      </span>
    </li>
  );
}

// Vista de muestra (no conectada al backend): réplica del Inicio real de cada rol.
export default function Demo() {
  const [rol, setRol] = useState('veterinario');
  const d = demo[rol];

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
        </div>

        <div className="lp-demo__cuerpo" key={rol}>
          {/* Barra lateral (igual que Sidebar.jsx) */}
          <aside className="lp-app-lateral" aria-hidden="true">
            <div className="lp-app-marca">
              <span className="lp-app-marca__emblema">
                <img src={emblema} alt="" width="32" height="32" />
              </span>
              <span className="lp-app-marca__texto">
                <strong>VetControl</strong>
                <small>AI · Cuidado inteligente</small>
              </span>
            </div>

            <ul className="lp-app-nav">
              {d.menu.map(({ label, icono: Icono }, i) => (
                <li key={label} className={i === 0 ? 'is-activo' : undefined}>
                  <Icono size={17} strokeWidth={1.8} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            <div className="lp-app-pie">
              <span className="lp-app-pie__fila">
                <i className="lp-app-circulo lp-app-circulo--ayuda">?</i>
                <span>
                  <strong>¿Necesitas ayuda?</strong>
                  <small>Estamos para ti</small>
                </span>
              </span>
              <span className="lp-app-pie__fila">
                <i className="lp-app-circulo lp-app-circulo--cuenta">
                  {iniciales(d.cuenta.nombre, d.cuenta.apellido)}
                </i>
                <span>
                  <strong>Mi cuenta</strong>
                  <small>{d.etiquetaRol}</small>
                </span>
              </span>
              <span className="lp-app-pie__salir">
                <LogOut size={16} strokeWidth={1.8} />
                Cerrar sesión
              </span>
            </div>
          </aside>

          {/* Contenido (igual que Topbar.jsx + Inicio.jsx) */}
          <div className="lp-app-contenido">
            <div className="lp-app-topbar">
              <p>
                {d.portal} <span aria-hidden="true">/</span> VetControl AI
              </p>
              <span className="lp-app-topbar__acciones" aria-hidden="true">
                <span className="lp-app-topbar__boton">
                  <Bell size={16} strokeWidth={1.8} />
                </span>
                <span className="lp-app-topbar__avatar">
                  {iniciales(d.cuenta.nombre, d.cuenta.apellido)}
                </span>
              </span>
            </div>

            <section className="lp-app-hola">
              <div className="lp-app-hola__texto">
                <p className="lp-app-hola__fecha">{fechaLarga()}</p>
                <h3>
                  ¡Hola, {d.cuenta.nombre}!{' '}
                  <span className="lp-app-hola__mano" aria-hidden="true">
                    👋
                  </span>
                </h3>
                <p className="lp-app-hola__lema">{d.lema}</p>
                <p className="lp-app-hola__sub">{d.subtitulo}</p>
              </div>
              <div className="lp-app-hola__arte" aria-hidden="true">
                <span className="lp-app-burbuja lp-app-burbuja--1" />
                <span className="lp-app-burbuja lp-app-burbuja--2" />
                <span className="lp-app-hola__emblema">
                  <img src={emblema} alt="" />
                </span>
                <span className="lp-app-flota lp-app-flota--corazon">
                  <HeartPulse size={20} />
                </span>
                <span className="lp-app-flota lp-app-flota--huella">
                  <PawPrint size={17} />
                </span>
                <span className="lp-app-flota lp-app-flota--mas">
                  <Plus size={18} strokeWidth={3} />
                </span>
              </div>
            </section>

            <div className="lp-app-metricas">
              {d.metricas.map((m) => (
                <Metrica key={m.titulo} m={m} citas={d.citas} />
              ))}
            </div>

            <section className="lp-app-bloque">
              <div className="lp-app-bloque__cabecera">
                <h4>{d.tituloMascotas}</h4>
                <span className="lp-app-ver">
                  Ver todas <ArrowRight size={13} />
                </span>
              </div>
              <ul className="lp-app-mascotas">
                {d.mascotas.map((m) => (
                  <MiniTarjeta key={m.nombre} mascota={m} />
                ))}
              </ul>
            </section>

            <div className="lp-app-inferior">
              <section className="lp-app-bloque">
                <div className="lp-app-bloque__cabecera">
                  <h4>
                    <Calendar size={16} aria-hidden="true" /> Próximas citas
                  </h4>
                  <span className="lp-app-ver">
                    Ver todas <ArrowRight size={13} />
                  </span>
                </div>
                <ul className="lp-app-citas">
                  {d.citas.map((c) => {
                    const f = partesFecha(c.dias);
                    return (
                      <li key={`${c.mascota}-${c.dias}`} className="lp-app-cita">
                        <span className="lp-app-cita__fecha">
                          <strong>{f.dia}</strong>
                          <span>{f.mes}</span>
                        </span>
                        <span className="lp-app-cita__texto">
                          <strong>
                            {c.mascota} · {c.tipo}
                          </strong>
                          <span>
                            {c.hora} · {c.con}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="lp-app-bloque lp-app-ia">
                <h4>
                  <span className="lp-app-ia__icono" aria-hidden="true">
                    <Bot size={18} />
                  </span>
                  VetControl AI
                </h4>
                <p className="lp-app-ia__pregunta">¿Qué quieres consultar?</p>
                <ul className="lp-app-ia__sugerencias">
                  {d.preguntas.map((p) => (
                    <li key={p}>
                      <Search size={14} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="lp-app-ia__boton">
                  Consultar a VetControl AI <ArrowRight size={15} />
                </span>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
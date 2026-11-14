import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import Navbar from '../components/publica/Navbar.jsx';
import Footer from '../components/publica/Footer.jsx';
import Demo from '../components/publica/Demo.jsx';
import {
  estadisticas,
  pilares,
  publico,
  funcionalidades,
} from '../data/paginaPublica.js';
import '../estilos/paginaPublica.css';

// Foto de Unsplash (licencia libre: Sander Mathlener, unsplash.com/photos/1Vw3xTj9UyE).
// Si no carga (sin internet), se muestra una huella como respaldo.
const FOTOS_HERO = [
  'https://images.unsplash.com/photo-1601543574606-1d8a714787f9?w=1120&q=80&auto=format&fit=crop',
];

function FotoHero() {
  const [intento, setIntento] = useState(0);
  if (intento >= FOTOS_HERO.length) {
    return (
      <div className="lp-hero__foto lp-hero__foto--vacia" aria-hidden="true">
        <PawPrint size={96} />
      </div>
    );
  }
  return (
    <img
      className="lp-hero__foto"
      src={FOTOS_HERO[intento]}
      alt="Perro golden retriever descansando al aire libre"
      onError={() => setIntento((i) => i + 1)}
    />
  );
}

export default function PaginaPublica() {
  useEffect(() => {
    document.title = 'VetControl AI · Gestión veterinaria inteligente';
  }, []);

  return (
    <div className="lp">
      <Navbar />

      <main>
        <section className="lp-hero" id="inicio">
          <div className="lp-hero__texto">
            <span className="lp-pill">
              <i aria-hidden="true" />
              Plataforma inteligente para clínicas veterinarias
            </span>
            <h1>
              Gestión clínica e <span>inteligencia artificial</span> para el
              bienestar animal
            </h1>
            <p className="lp-hero__desc">
              Centraliza las historias clínicas, la comunicación directa entre
              veterinario y propietario mediante chat, y un asistente de IA que
              resume la información médica y ayuda a prevenir tratamientos
              pendientes.
            </p>
            <div className="lp-hero__botones">
              <Link to="/registro" className="lp-boton">
                Explorar plataforma
              </Link>
              <a href="#demo" className="lp-boton lp-boton--borde">
                Ver asistente IA
              </a>
            </div>
            <dl className="lp-hero__stats">
              {estadisticas.map((e) => (
                <div key={e.valor}>
                  <dt className={e.acento ? 'is-acento' : undefined}>
                    {e.valor}
                  </dt>
                  <dd>{e.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
          <FotoHero />
        </section>

        <section className="lp-sobre" id="sobre">
          <header className="lp-encabezado lp-encabezado--centro">
            <p className="lp-eyebrow">PROPUESTA DE SOLUCIÓN TECNOLÓGICA</p>
            <h2>Transformando la Gestión Veterinaria Tradicional</h2>
            <p>
              Muchas clínicas continúan gestionando registros de manera manual o
              dispersa. VetControl AI integra en una sola plataforma web el
              historial médico, el contacto bidireccional y la asistencia
              predictiva.
            </p>
          </header>

          <div className="lp-grid lp-grid--3">
            {pilares.map(({ icono: Icono, titulo, texto }) => (
              <article key={titulo} className="lp-card lp-card--suave">
                <span className="lp-icono lp-icono--grande">
                  <Icono size={22} aria-hidden="true" />
                </span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </article>
            ))}
          </div>

          <div className="lp-publico">
            <p className="lp-publico__titulo">¿Para quién es VetControl AI?</p>
            <div className="lp-grid lp-grid--2">
              {publico.map(({ icono: Icono, titulo, texto }) => (
                <div key={titulo} className="lp-publico__item">
                  <span className="lp-icono">
                    <Icono size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{titulo}</h3>
                    <p>{texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-func" id="funcionalidades">
          <header className="lp-func__encabezado">
            <div className="lp-encabezado">
              <p className="lp-eyebrow lp-eyebrow--oscuro">
                MÓDULOS DEL SISTEMA
              </p>
              <h2>Funcionalidades Clave</h2>
            </div>
            <p>
              Diseñado para responder tanto a las necesidades administrativas
              del veterinario como a la tranquilidad del propietario de la
              mascota.
            </p>
          </header>

          <div className="lp-grid lp-grid--3">
            {funcionalidades.map(
              ({ icono: Icono, etiqueta, titulo, texto }) => (
                <article key={titulo} className="lp-card">
                  <div className="lp-card__top">
                    <span className="lp-icono">
                      <Icono size={20} aria-hidden="true" />
                    </span>
                    <span className="lp-tag">{etiqueta}</span>
                  </div>
                  <h3>{titulo}</h3>
                  <p>{texto}</p>
                </article>
              )
            )}
          </div>
        </section>

        <section className="lp-demo" id="demo">
          <header className="lp-encabezado lp-encabezado--centro">
            <p className="lp-eyebrow lp-eyebrow--acento">DEMO INTERACTIVA</p>
            <h2>Explora la plataforma en acción</h2>
            <p>
              Alterna entre la vista del personal veterinario y la del
              propietario de la mascota.
            </p>
          </header>
          <Demo />
        </section>
      </main>

      <Footer />
    </div>
  );
}

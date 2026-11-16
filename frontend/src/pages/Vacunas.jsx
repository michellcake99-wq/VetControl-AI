import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IdCard, Syringe } from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { fechaCorta } from '../utils/format.js';
import { estadoDosis } from '../utils/vacunas.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FotoMascota from '../components/FotoMascota.jsx';

const lista = (r) => (Array.isArray(r) ? r : (r?.datos ?? []));

/** Próximo refuerzo pendiente (la próxima dosis más cercana de la última aplicación de cada vacuna). */
function proximoRefuerzo(vacunas) {
  const ultimaPorNombre = new Map();
  for (const v of vacunas) {
    const anterior = ultimaPorNombre.get(v.nombre);
    if (!anterior || v.fecha_aplicacion > anterior.fecha_aplicacion) {
      ultimaPorNombre.set(v.nombre, v);
    }
  }
  return (
    [...ultimaPorNombre.values()]
      .filter((v) => v.proxima_dosis)
      .sort((a, b) => a.proxima_dosis.localeCompare(b.proxima_dosis))[0] ?? null
  );
}

/**
 * Ep4-Hu1: acceso al carné de vacunación de cada mascota.
 * El propietario ve el próximo refuerzo de cada una de sus mascotas.
 */
export default function Vacunas() {
  const esPropietario = rolActual() === 'propietario';
  const [mascotas, setMascotas] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const encontradas = lista(await api.get('/mascotas?limite=100'));
        // Para el propietario (pocas mascotas) se trae el carné de cada una
        const conCarne = esPropietario
          ? await Promise.all(
              encontradas.map(async (m) => {
                const historia = await api
                  .get(`/mascotas/${m.id_mascota}/historia`)
                  .catch(() => null);
                return {
                  ...m,
                  totalVacunas: historia?.vacunas.length ?? 0,
                  proximo: historia ? proximoRefuerzo(historia.vacunas) : null,
                };
              })
            )
          : encontradas;
        if (!cancelado) setMascotas(conCarne);
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'No se pudieron cargar las mascotas.');
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esPropietario]);

  return (
    <section>
      <div className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Vacunas</h1>
          <p className="texto-sec">
            {esPropietario
              ? 'Consulta el carné de vacunación de tus mascotas.'
              : 'Elige una mascota para ver, registrar o corregir sus vacunas.'}
          </p>
        </div>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {!mascotas && !error ? (
        <CargandoInline texto="Cargando mascotas…" />
      ) : mascotas?.length === 0 ? (
        <div className="vacio">
          <span className="icono-circulo icono-circulo--44" aria-hidden="true">
            <Syringe size={22} strokeWidth={1.8} />
          </span>
          <p className="texto-sec">Todavía no hay mascotas registradas.</p>
        </div>
      ) : (
        <div className="rejilla-tarjetas">
          {mascotas?.map((m) => {
            const estado = m.proximo && estadoDosis(m.proximo.proxima_dosis);
            return (
              <article key={m.id_mascota} className="tarjeta tarjeta-mascota">
                <div className="tarjeta-mascota__cabecera">
                  <FotoMascota mascota={m} tamano={52} />
                  <div>
                    <p className="tarjeta-mascota__nombre">{m.nombre}</p>
                    <p className="tarjeta-mascota__detalle">
                      {m.especie}
                      {!esPropietario && m.nombre_propietario
                        ? ` · Dueño/a: ${m.nombre_propietario}`
                        : ''}
                    </p>
                  </div>
                </div>

                {esPropietario && (
                  <p className="tarjeta-mascota__detalle">
                    {m.totalVacunas === 0
                      ? 'Sin vacunas registradas'
                      : m.proximo
                        ? `Próximo refuerzo: ${m.proximo.nombre}, ${fechaCorta(m.proximo.proxima_dosis)}`
                        : `${m.totalVacunas} vacunas, sin refuerzos pendientes`}
                  </p>
                )}
                {estado && (
                  <span className={`estado estado--${estado.clase}`}>
                    {estado.texto}
                  </span>
                )}

                <div className="tarjeta-mascota__acciones">
                  <Link
                    to={`/mascotas/${m.id_mascota}/carne`}
                    className="boton boton--oscuro boton--peq"
                  >
                    <IdCard size={14} />
                    Ver carné
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
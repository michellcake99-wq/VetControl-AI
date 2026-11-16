import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarPlus,
  ClipboardList,
  ClipboardPlus,
  IdCard,
  Pencil,
  Phone,
  User,
} from 'lucide-react';
import { api } from '../services/api.js';
import { rolActual } from '../utils/sesion.js';
import { fechaCorta } from '../utils/format.js';
import { calcularEdad, ETIQUETA_SEXO } from '../utils/mascotas.js';
import Alerta from '../components/Alerta.jsx';
import BotonVolver from '../components/BotonVolver.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FotoMascota from '../components/FotoMascota.jsx';
import PanelMascota from '../components/mascotas/PanelMascota.jsx';

const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Ficha de una mascota: sus datos y, en pestañas, su historia clínica (consultas),
 * vacunas y tratamientos. Se abre al tocar una tarjeta en «Mis mascotas» / «Pacientes».
 */
export default function DetalleMascota() {
  const { id } = useParams();
  const rol = rolActual();
  const esPersonal = rol === 'veterinario' || rol === 'administrador';
  const [mascota, setMascota] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/mascotas/${id}`)
      .then((datos) => {
        if (!cancelado) setMascota(datos);
      })
      .catch((err) => {
        if (!cancelado)
          setError(
            err.estado === 404 || err.estado === 403
              ? 'No encontramos esta mascota o no tienes permiso para verla.'
              : err.message || 'No se pudo cargar la mascota.'
          );
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (!mascota) {
    return (
      <section>
        <BotonVolver a="/mascotas" texto="Volver" />
        {error ? (
          <Alerta tipo="error">{error}</Alerta>
        ) : (
          <CargandoInline texto="Cargando ficha…" />
        )}
      </section>
    );
  }

  const datos = [
    ['Especie', mayuscula(mascota.especie)],
    ['Raza', mascota.raza],
    [
      'Sexo',
      mascota.sexo === 'desconocido' ? null : ETIQUETA_SEXO[mascota.sexo],
    ],
    [
      'Nacimiento',
      mascota.fecha_nacimiento && fechaCorta(mascota.fecha_nacimiento),
    ],
    ['Color', mascota.color],
    ['Peso', mascota.peso_kg && `${mascota.peso_kg} kg`],
    ['Microchip', mascota.microchip],
  ];
  const { propietario } = mascota;

  return (
    <section className="detalle-mascota">
      <BotonVolver a="/mascotas" texto="Volver" />

      <article className="tarjeta detalle-mascota__cabecera">
        <FotoMascota mascota={mascota} tamano={124} />
        <div className="detalle-mascota__info">
          <h1 className="detalle-mascota__nombre">{mascota.nombre}</h1>
          <div className="ficha-mascota__chips">
            <span>{mayuscula(mascota.especie)}</span>
            {mascota.raza && <span>{mascota.raza}</span>}
            {mascota.fecha_nacimiento && (
              <span>{calcularEdad(mascota.fecha_nacimiento)}</span>
            )}
          </div>

          <dl className="detalle-mascota__datos">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor || '—'}</dd>
              </div>
            ))}
          </dl>

          {esPersonal && propietario && (
            <p className="detalle-mascota__dueno">
              <User size={15} aria-hidden="true" />
              {propietario.nombre} {propietario.apellido}
              {propietario.telefono && (
                <>
                  <Phone size={14} aria-hidden="true" />
                  <a href={`tel:${propietario.telefono}`}>
                    {propietario.telefono}
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="detalle-mascota__acciones">
          <Link
            to={`/mascotas/${id}/historia`}
            className="boton boton--oscuro boton--peq"
          >
            <ClipboardList size={15} />
            Historia clínica
          </Link>
          <Link
            to={`/mascotas/${id}/carne`}
            className="boton boton--claro boton--peq"
          >
            <IdCard size={15} />
            Carné de vacunación
          </Link>
          {rol === 'veterinario' && (
            <Link
              to={`/consultas/nueva?mascota=${id}`}
              className="boton boton--claro boton--peq"
            >
              <ClipboardPlus size={15} />
              Nueva consulta
            </Link>
          )}
          <Link
            to={`/citas/nueva?mascota=${id}`}
            className="boton boton--claro boton--peq"
          >
            <CalendarPlus size={15} />
            {rol === 'propietario' ? 'Solicitar cita' : 'Agendar cita'}
          </Link>
          <Link
            to={`/mascotas/${id}/editar`}
            className="boton boton--claro boton--peq"
          >
            <Pencil size={15} />
            Editar
          </Link>
        </div>
      </article>

      <div className="detalle-mascota__panel">
        <PanelMascota mascota={mascota} maximo={8} />
      </div>
    </section>
  );
}

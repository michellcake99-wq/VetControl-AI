import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Download,
  PawPrint,
  Pencil,
  Plus,
  Phone,
  ShieldCheck,
  Syringe,
  User,
} from 'lucide-react';
import { api } from '../services/api.js';
import { fechaCorta, fechaLarga } from '../utils/format.js';
import { calcularEdad, ETIQUETA_SEXO } from '../utils/mascotas.js';
import { estadoEnCarne } from '../utils/vacunas.js';
import { rolActual } from '../utils/sesion.js';
import { descargarPDF } from '../utils/pdf.js';
import Alerta from '../components/Alerta.jsx';
import CargandoInline from '../components/CargandoInline.jsx';
import FormularioVacuna from '../components/historia/FormularioVacuna.jsx';
import logo from '../assets/logo-emblema.png';

/** Número propio del carné (independiente de la historia clínica): CV-000001 */
const numeroCarne = (idMascota) => `CV-${String(idMascota).padStart(6, '0')}`;

/** Nombre de archivo seguro: "Carne_vacunacion_Max_CV-000001.pdf" */
const nombreArchivo = (mascota) =>
  `Carne_vacunacion_${mascota.nombre}_${numeroCarne(mascota.id_mascota)}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_') + '.pdf';

/** Próximo refuerzo pendiente (el más cercano que no ha vencido) y cuántos vencieron. */
function resumir(vacunas) {
  const conEstado = vacunas.map((v) => ({
    ...v,
    estado: estadoEnCarne(v, vacunas),
  }));
  const pendientes = conEstado.filter(
    (v) =>
      v.proxima_dosis && !['finalizado', 'vencida'].includes(v.estado.clase)
  );
  const proximo =
    pendientes.sort((a, b) =>
      a.proxima_dosis.localeCompare(b.proxima_dosis)
    )[0] ?? null;
  const vencidas = conEstado.filter((v) => v.estado.clase === 'vencida').length;
  return { conEstado, proximo, vencidas };
}

/** "canino" -> "Canino" */
const mayuscula = (texto) =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

/** Un dato de la mascota o del propietario dentro del carné. */
function Dato({ etiqueta, valor, ancho }) {
  return (
    <div className={`carne__dato${ancho ? ' carne__dato--ancho' : ''}`}>
      <span>{etiqueta}</span>
      <strong>{valor || '—'}</strong>
    </div>
  );
}

/**
 * Carné de vacunación de una mascota: documento propio, con diseño y tamaño
 * (media carta / A5) distintos a los de la historia clínica.
 * Lo pueden ver y descargar todos los roles (el propietario solo el de sus mascotas).
 * El veterinario registra y corrige las vacunas desde aquí mismo (Ep4-Hu1).
 */
export default function CarneVacunacion() {
  const { id } = useParams();
  const documento = useRef(null);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const esVeterinario = rolActual() === 'veterinario';
  // null = sin formulario; { vacuna: null } = registrar; { vacuna } = corregir
  const [formulario, setFormulario] = useState(null);
  const [exito, setExito] = useState('');

  async function alGuardar(vacuna, eraCorreccion) {
    setFormulario(null);
    setError('');
    setExito(
      eraCorreccion
        ? `Se corrigió el registro de ${vacuna.nombre}.`
        : `${vacuna.nombre} quedó registrada en el carné.`
    );
    try {
      // Se vuelve a pedir la lista para mostrarla en orden cronológico
      const lista = await api.get(`/historias/${datos.id_historia}/vacunas`);
      setDatos((d) => ({ ...d, vacunas: lista }));
    } catch {
      setError(
        'La vacuna se guardó, pero no se pudo actualizar el carné. Recarga la página.'
      );
    }
  }

  function abrirFormulario(vacuna) {
    setExito('');
    setFormulario({ vacuna });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    let cancelado = false;
    api
      .get(`/mascotas/${id}/historia`)
      .then((r) => {
        if (!cancelado) setDatos(r);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err.estado === 404 || err.estado === 403
              ? 'No encontramos el carné de esta mascota o no tienes permiso para verlo.'
              : err.message || 'No se pudo cargar el carné de vacunación.'
          );
        }
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  async function descargar() {
    setError('');
    flushSync(() => setExportando(true));
    try {
      await descargarPDF(documento.current, nombreArchivo(datos.mascota), {
        titulo: `Carné de vacunación ${numeroCarne(datos.mascota.id_mascota)}`,
        formato: 'a5',
      });
    } catch {
      setError('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setExportando(false);
    }
  }

  const volver = (
    <Link to="/vacunas" className="historia__volver">
      <ArrowLeft size={16} aria-hidden="true" />
      Volver a vacunas
    </Link>
  );

  if (!datos) {
    return (
      <section>
        {volver}
        {error ? (
          <Alerta tipo="error">{error}</Alerta>
        ) : (
          <CargandoInline texto="Cargando carné de vacunación…" />
        )}
      </section>
    );
  }

  const { mascota, propietario, vacunas } = datos;
  const { conEstado, proximo, vencidas } = resumir(vacunas);

  return (
    <section className="pagina-carne">
      {volver}

      <header className="encabezado-pagina">
        <div>
          <h1 className="saludo__titulo">Carné de vacunación</h1>
          <p className="texto-sec">
            {mascota.nombre} · {numeroCarne(mascota.id_mascota)} ·{' '}
            {vacunas.length}{' '}
            {vacunas.length === 1 ? 'vacuna registrada' : 'vacunas registradas'}
          </p>
        </div>
        <div className="encabezado-pagina__acciones">
          {esVeterinario && (
            <button
              type="button"
              className="boton boton--claro"
              onClick={() => abrirFormulario(null)}
              disabled={Boolean(formulario)}
            >
              <Plus size={16} />
              Registrar vacuna
            </button>
          )}
          <button
            type="button"
            className="boton boton--oscuro"
            onClick={descargar}
            disabled={exportando || Boolean(formulario)}
          >
            <Download size={16} />
            {exportando ? 'Generando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      </header>
      <Alerta tipo="exito">{exito}</Alerta>
      <Alerta tipo="error">{error}</Alerta>

      {formulario && (
        <div className="carne-formulario tarjeta">
          <FormularioVacuna
            idHistoria={datos.id_historia}
            especie={mascota.especie}
            vacuna={formulario.vacuna}
            onGuardada={alGuardar}
            onCancelar={() => setFormulario(null)}
          />
        </div>
      )}

      <article
        ref={documento}
        className={`carnet${exportando ? ' carnet--exportando' : ''}`}
        aria-label={`Carné de vacunación de ${mascota.nombre}`}
      >
        {/* Portada */}
        <header className="carne__portada pdf-bloque">
          <div className="carne__marca">
            <span className="carne__logo">
              <img src={logo} alt="VetControl AI" />
            </span>
            <div>
              <p className="carne__titulo">Carné de vacunación</p>
              <p className="carne__clinica">
                VetControl AI · Clínica veterinaria
              </p>
            </div>
          </div>
          <div className="carne__numero">
            <span>N.º</span>
            <strong>{numeroCarne(mascota.id_mascota)}</strong>
          </div>
        </header>

        {/* Mascota */}
        <section className="carne__perfil pdf-bloque" aria-label="Mascota">
          {mascota.foto ? (
            <img
              className="carne__foto"
              src={mascota.foto}
              alt={`Foto de ${mascota.nombre}`}
            />
          ) : (
            <span className="carne__foto carne__foto--vacia" aria-hidden="true">
              <PawPrint size={44} strokeWidth={1.6} />
            </span>
          )}
          <div className="carne__perfil-texto">
            <span className="carne__etiqueta">Nombre de la mascota</span>
            <h2 className="carne__nombre">{mascota.nombre}</h2>
            <div className="carne__chips">
              <span>{mayuscula(mascota.especie)}</span>
              {mascota.raza && <span>{mayuscula(mascota.raza)}</span>}
              {mascota.fecha_nacimiento && (
                <span>{calcularEdad(mascota.fecha_nacimiento)}</span>
              )}
            </div>
          </div>
        </section>

        <section
          className="carne__bloque pdf-bloque"
          aria-labelledby="carne-datos"
        >
          <h3 id="carne-datos" className="carne__subtitulo">
            <PawPrint size={14} aria-hidden="true" /> Datos de la mascota
          </h3>
          <div className="carne__datos">
            <Dato etiqueta="Especie" valor={mayuscula(mascota.especie)} />
            <Dato etiqueta="Raza" valor={mayuscula(mascota.raza)} />
            <Dato
              etiqueta="Sexo"
              valor={
                mascota.sexo === 'desconocido'
                  ? 'No registrado'
                  : ETIQUETA_SEXO[mascota.sexo]
              }
            />
            <Dato
              etiqueta="Fecha de nacimiento"
              valor={
                mascota.fecha_nacimiento && fechaCorta(mascota.fecha_nacimiento)
              }
            />
            <Dato etiqueta="Color" valor={mascota.color} ancho />
          </div>
        </section>

        <section
          className="carne__bloque pdf-bloque"
          aria-labelledby="carne-propietario"
        >
          <h3 id="carne-propietario" className="carne__subtitulo">
            <User size={14} aria-hidden="true" /> Propietario
          </h3>
          <div className="carne__datos">
            <Dato
              etiqueta="Nombre"
              valor={`${propietario.nombre} ${propietario.apellido}`}
            />
            <Dato
              etiqueta="Teléfono"
              valor={
                propietario.telefono && (
                  <>
                    <Phone size={12} aria-hidden="true" />{' '}
                    {propietario.telefono}
                  </>
                )
              }
            />
          </div>
        </section>

        {/* Resumen */}
        {vacunas.length > 0 && (
          <div className="carne__resumen pdf-bloque">
            <div>
              <Syringe size={16} aria-hidden="true" />
              <span>
                <strong>{vacunas.length}</strong>{' '}
                {vacunas.length === 1 ? 'vacuna' : 'vacunas'}
              </span>
            </div>
            <div>
              <CalendarClock size={16} aria-hidden="true" />
              <span>
                Próximo refuerzo:{' '}
                <strong>
                  {proximo
                    ? `${proximo.nombre} · ${fechaCorta(proximo.proxima_dosis)}`
                    : 'ninguno pendiente'}
                </strong>
              </span>
            </div>
            <div className={vencidas ? 'carne__resumen--alerta' : ''}>
              <ShieldCheck size={16} aria-hidden="true" />
              <strong>
                {vencidas
                  ? `${vencidas} ${vencidas === 1 ? 'refuerzo vencido' : 'refuerzos vencidos'}`
                  : 'Al día'}
              </strong>
            </div>
          </div>
        )}

        {/* Vacunas */}
        <section className="carne__bloque" aria-labelledby="carne-vacunas">
          <h3 id="carne-vacunas" className="carne__subtitulo pdf-bloque">
            <Syringe size={14} aria-hidden="true" /> Vacunas aplicadas
          </h3>
          {vacunas.length === 0 ? (
            <p className="carne__vacio">
              Esta mascota todavía no tiene vacunas registradas.
            </p>
          ) : (
            <ol className="carne__vacunas">
              {conEstado.map((v) => (
                <li
                  key={v.id_vacuna}
                  className={`carne__vacuna carne__vacuna--${v.estado.clase} pdf-bloque`}
                >
                  <div className="carne__vacuna-cabecera">
                    <div>
                      <span className="carne__etiqueta">Vacuna</span>
                      <strong className="carne__vacuna-nombre">
                        {v.nombre}
                      </strong>
                    </div>
                    <span
                      className={`carne__estado carne__estado--${v.estado.clase}`}
                    >
                      {v.estado.texto}
                    </span>
                  </div>
                  <div className="carne__vacuna-datos">
                    <Dato
                      etiqueta="Fecha"
                      valor={fechaCorta(v.fecha_aplicacion)}
                    />
                    <Dato
                      etiqueta="Próxima dosis"
                      valor={v.proxima_dosis && fechaCorta(v.proxima_dosis)}
                    />
                    <Dato etiqueta="Laboratorio" valor={v.laboratorio} />
                    <Dato etiqueta="Lote" valor={v.lote} />
                  </div>
                  <div className="carne__vacuna-pie">
                    {v.nombre_veterinario && (
                      <p className="carne__aplico">
                        Aplicó: {v.nombre_veterinario}
                      </p>
                    )}
                    {esVeterinario && (
                      <button
                        type="button"
                        className="carne__corregir no-pdf"
                        onClick={() =>
                          abrirFormulario(
                            vacunas.find((x) => x.id_vacuna === v.id_vacuna)
                          )
                        }
                        disabled={Boolean(formulario)}
                      >
                        <Pencil size={12} aria-hidden="true" />
                        Corregir
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="carne__pie pdf-bloque">
          Emitido el {fechaLarga()} · Presente este carné en cada visita a la
          clínica.
        </footer>
      </article>
    </section>
  );
}
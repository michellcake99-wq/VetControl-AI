import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PawPrint,
  RefreshCw,
  Sparkles,
  Syringe,
  Pill,
  Stethoscope,
} from 'lucide-react';
import { api } from '../services/api.js';
import './PendientesClinicos.css';

const TIPOS = {
  vacuna: {
    etiqueta: 'Vacuna vencida',
    plural: 'Vacunas vencidas',
    icono: Syringe,
    clase: 'vacuna',
  },
  tratamiento: {
    etiqueta: 'Tratamiento sin cerrar',
    plural: 'Tratamientos sin cerrar',
    icono: Pill,
    clase: 'tratamiento',
  },
  sin_consulta: {
    etiqueta: 'Sin consulta reciente',
    plural: 'Sin consulta reciente',
    icono: CalendarClock,
    clase: 'consulta',
  },
};

const FILTROS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'vacuna', texto: 'Vacunas' },
  { valor: 'tratamiento', texto: 'Tratamientos' },
  { valor: 'sin_consulta', texto: 'Sin consulta' },
];

function fechaLegible(fecha) {
  if (!fecha) return 'Sin consultas registradas';
  // Se construye la fecha local a partir de AAAA-MM-DD para evitar desfases UTC.
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia));
}

function clavePendiente(pendiente) {
  return `${pendiente.id_mascota}-${pendiente.tipo}-${pendiente.id_registro ?? 'sin-registro'}`;
}

function TarjetaPendiente({ pendiente, sugerencia, cargandoIA, errorIA, onSugerir }) {
  const tipo = TIPOS[pendiente.tipo] ?? TIPOS.sin_consulta;
  const Icono = tipo.icono;
  const fecha = fechaLegible(pendiente.fecha_pendiente);

  return (
    <article className="pendiente-clinico tarjeta">
      <div className={`pendiente-clinico__icono pendiente-clinico__icono--${tipo.clase}`}>
        <Icono size={21} aria-hidden="true" />
      </div>

      <div className="pendiente-clinico__contenido">
        <div className="pendiente-clinico__encabezado">
          <div>
            <span className="pendiente-clinico__tipo">{tipo.etiqueta}</span>
            <h2>{pendiente.nombre_mascota}</h2>
            <p className="pendiente-clinico__especie">
              {pendiente.especie || 'Especie no registrada'}
              {pendiente.numero_historia ? ` · Historia ${pendiente.numero_historia}` : ''}
            </p>
          </div>
          <span className={`pendiente-clinico__estado pendiente-clinico__estado--${tipo.clase}`}>
            <AlertTriangle size={13} aria-hidden="true" />
            Requiere revisión
          </span>
        </div>

        <p className="pendiente-clinico__motivo">{pendiente.motivo}</p>
        <div className="pendiente-clinico__detalle">
          <span><strong>Detalle:</strong> {pendiente.detalle || tipo.etiqueta}</span>
          <span><strong>Fecha:</strong> {fecha}</span>
        </div>

        {sugerencia && (
          <div className="pendiente-clinico__sugerencia" aria-live="polite">
            <div className="pendiente-clinico__sugerencia-titulo">
              <Sparkles size={16} aria-hidden="true" />
              Sugerencia de IA
            </div>
            <p>{sugerencia}</p>
            <small>Apoyo orientativo. No modifica automáticamente la información clínica.</small>
          </div>
        )}

        {errorIA && <p className="pendiente-clinico__error" role="alert">{errorIA}</p>}

        <div className="pendiente-clinico__acciones">
          <button
            type="button"
            className="boton boton--claro boton--peq"
            onClick={() => onSugerir(pendiente)}
            disabled={cargandoIA}
          >
            <Sparkles size={15} aria-hidden="true" />
            {cargandoIA ? 'Generando sugerencia…' : sugerencia ? 'Volver a sugerir' : 'Sugerencia IA'}
          </button>
          <Link
            to={`/mascotas/${pendiente.id_mascota}/historia`}
            className="pendiente-clinico__historia"
          >
            Ver historia clínica <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function PendientesClinicos() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [cargandoIA, setCargandoIA] = useState({});
  const [sugerencias, setSugerencias] = useState({});
  const [erroresIA, setErroresIA] = useState({});

  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const respuesta = await api.get('/mascotas/pendientes-clinicos');
      setDatos(respuesta);
      // Las sugerencias pertenecen a los registros vigentes; al recargar se limpian.
      setSugerencias({});
      setErroresIA({});
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los pendientes clínicos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const pendientes = useMemo(() => datos?.datos ?? [], [datos]);
  const filtrados = useMemo(
    () => filtro === 'todos' ? pendientes : pendientes.filter((p) => p.tipo === filtro),
    [pendientes, filtro]
  );

  async function generarSugerencia(pendiente) {
    const clave = clavePendiente(pendiente);
    setCargandoIA((actual) => ({ ...actual, [clave]: true }));
    setErroresIA((actual) => ({ ...actual, [clave]: '' }));
    try {
      const cuerpo = {
        id_mascota: pendiente.id_mascota,
        tipo: pendiente.tipo,
        ...(pendiente.id_registro != null ? { id_registro: pendiente.id_registro } : {}),
      };
      const respuesta = await api.post('/ia/sugerir-pendiente', cuerpo);
      setSugerencias((actual) => ({ ...actual, [clave]: respuesta.respuesta }));
    } catch (e) {
      setErroresIA((actual) => ({ ...actual, [clave]: e.message || 'No se pudo generar la sugerencia.' }));
    } finally {
      setCargandoIA((actual) => ({ ...actual, [clave]: false }));
    }
  }

  const resumen = datos?.resumen ?? {
    vacunas_vencidas: 0,
    tratamientos_sin_cerrar: 0,
    sin_consulta_90_dias: 0,
  };

  return (
    <div className="pagina-pendientes-clinicos">
      <header className="encabezado-pendientes-clinicos">
        <div>
          <p className="encabezado-pendientes-clinicos__sobrelinea">
            <Stethoscope size={15} aria-hidden="true" /> Seguimiento veterinario
          </p>
          <h1>Pendientes clínicos</h1>
          <p>Información clínica que requiere revisión o actualización.</p>
        </div>
        <button
          type="button"
          className="boton boton--claro"
          onClick={cargarPendientes}
          disabled={cargando}
        >
          <RefreshCw size={16} className={cargando ? 'pendientes-girando' : ''} />
          Actualizar
        </button>
      </header>

      <section className="resumen-pendientes-clinicos" aria-label="Resumen de pendientes">
        <article className="tarjeta resumen-pendiente resumen-pendiente--vacuna">
          <span className="resumen-pendiente__icono"><Syringe size={20} /></span>
          <div><strong>{cargando ? '—' : resumen.vacunas_vencidas}</strong><span>Vacunas vencidas</span></div>
        </article>
        <article className="tarjeta resumen-pendiente resumen-pendiente--tratamiento">
          <span className="resumen-pendiente__icono"><Pill size={20} /></span>
          <div><strong>{cargando ? '—' : resumen.tratamientos_sin_cerrar}</strong><span>Tratamientos sin cerrar</span></div>
        </article>
        <article className="tarjeta resumen-pendiente resumen-pendiente--consulta">
          <span className="resumen-pendiente__icono"><CalendarClock size={20} /></span>
          <div><strong>{cargando ? '—' : resumen.sin_consulta_90_dias}</strong><span>Sin consulta en 90 días</span></div>
        </article>
      </section>

      <section className="listado-pendientes-clinicos tarjeta" aria-labelledby="listado-pendientes-titulo">
        <div className="listado-pendientes-clinicos__cabecera">
          <div>
            <h2 id="listado-pendientes-titulo">Pacientes que requieren atención</h2>
            <p>{cargando ? 'Consultando información clínica…' : `${datos?.total ?? 0} pendientes identificados`}</p>
          </div>
          <span className="listado-pendientes-clinicos__total">
            <ClipboardList size={16} /> {datos?.total ?? 0}
          </span>
        </div>

        <div className="filtros-pendientes-clinicos" role="group" aria-label="Filtrar pendientes por tipo">
          {FILTROS.map((opcion) => (
            <button
              type="button"
              key={opcion.valor}
              className={filtro === opcion.valor ? 'filtro-pendiente filtro-pendiente--activo' : 'filtro-pendiente'}
              onClick={() => setFiltro(opcion.valor)}
            >
              {opcion.texto}
              {opcion.valor !== 'todos' && datos && (
                <span>{resumen[opcion.valor === 'vacuna' ? 'vacunas_vencidas' : opcion.valor === 'tratamiento' ? 'tratamientos_sin_cerrar' : 'sin_consulta_90_dias']}</span>
              )}
            </button>
          ))}
        </div>

        {error ? (
          <div className="estado-vacio-pendientes" role="alert">
            <AlertCircle size={25} />
            <p>{error}</p>
            <button type="button" className="boton boton--oscuro boton--peq" onClick={cargarPendientes}>Reintentar</button>
          </div>
        ) : cargando ? (
          <div className="estado-vacio-pendientes"><RefreshCw size={24} className="pendientes-girando" /><p>Cargando pendientes clínicos…</p></div>
        ) : filtrados.length === 0 ? (
          <div className="estado-vacio-pendientes">
            <CheckCircle2 size={30} />
            <strong>{filtro === 'todos' ? '¡Todo está al día!' : 'No hay pendientes de este tipo'}</strong>
            <p>{filtro === 'todos' ? 'No se identificaron pendientes clínicos para las mascotas activas.' : 'Prueba con otro filtro para consultar los demás pendientes.'}</p>
          </div>
        ) : (
          <div className="lista-pendientes-clinicos">
            {filtrados.map((pendiente) => {
              const clave = clavePendiente(pendiente);
              return (
                <TarjetaPendiente
                  key={clave}
                  pendiente={pendiente}
                  sugerencia={sugerencias[clave]}
                  cargandoIA={Boolean(cargandoIA[clave])}
                  errorIA={erroresIA[clave]}
                  onSugerir={generarSugerencia}
                />
              );
            })}
          </div>
        )}
      </section>

      <p className="nota-pendientes-clinicos">
        <PawPrint size={15} aria-hidden="true" /> Los pendientes se calculan con los registros clínicos actuales. Al actualizar la información de una mascota, vuelve a consultar esta sección para verificar los cambios.
      </p>
    </div>
  );
}

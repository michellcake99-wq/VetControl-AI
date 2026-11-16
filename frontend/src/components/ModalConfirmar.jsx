export default function ModalConfirmar({
  titulo,
  mensaje,
  confirmando,
  textoConfirmar = 'Sí, desactivar',
  onConfirmar,
  onCancelar,
}) {
  return (
    <div className="modal__fondo" role="presentation" onClick={onCancelar}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-titulo" className="modal__titulo">
          {titulo}
        </h2>
        <p className="texto-sec">{mensaje}</p>
        <div className="formulario__acciones">
          <button
            type="button"
            className="boton boton--claro"
            onClick={onCancelar}
            disabled={confirmando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--peligro"
            onClick={onConfirmar}
            disabled={confirmando}
          >
            {confirmando ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
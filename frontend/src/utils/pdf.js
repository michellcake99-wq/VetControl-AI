// Descarga de documentos en PDF: historia clínica y hoja de consulta (tamaño carta)
// y carné de vacunación (tamaño media carta / A5).
//
// Cómo funciona: el documento se "fotografía" una sola vez y luego se reparte en
// páginas cortando SOLO en lugares seguros (entre filas o entre secciones), así
// nunca queda una fila partida a la mitad ni un título solo al final de una hoja.
// Las librerías se cargan únicamente cuando alguien presiona "Descargar PDF".

const MARGEN = 10; // mm
const MARGEN_INFERIOR = 14; // mm (deja espacio para el pie de página)

/** Rectángulo de un elemento relativo al documento, en píxeles de pantalla. */
function posicion(el, origen) {
  const r = el.getBoundingClientRect();
  return { arriba: r.top - origen.top, abajo: r.bottom - origen.top };
}

/**
 * Calcula dónde se puede cortar el documento y qué tramos no se deben partir.
 * - Se puede cortar al final de cada fila de tabla y de cada bloque del documento.
 * - No se parte: una sección que cabe en una página, un bloque marcado con
 *   .formato__evitar-corte, ni una barra de título junto con su primera fila.
 */
function analizar(documento, altoPagina) {
  const origen = documento.getBoundingClientRect();
  const cortes = new Set([0, origen.height]);
  const protegidos = [];

  const bloques = documento.querySelectorAll(
    ':scope > *, .formato__seccion, .formato__datos > *, tr, .formato__evitar-corte, .pdf-bloque'
  );
  for (const el of bloques) cortes.add(posicion(el, origen).abajo);

  for (const el of documento.querySelectorAll(
    '.formato__seccion, .formato__evitar-corte, .formato__datos > *, .pdf-bloque'
  )) {
    const p = posicion(el, origen);
    if (p.abajo - p.arriba <= altoPagina * 0.9) protegidos.push(p);
  }
  for (const barra of documento.querySelectorAll('.formato__barra')) {
    const seccion = barra.closest('.formato__seccion') ?? barra.parentElement;
    const siguiente =
      seccion.querySelector('tbody tr') ?? barra.nextElementSibling ?? barra;
    protegidos.push({
      arriba: posicion(barra, origen).arriba,
      abajo: posicion(siguiente, origen).abajo,
    });
  }

  const valido = (y) =>
    !protegidos.some((p) => y > p.arriba + 1 && y < p.abajo - 1);
  return {
    alto: origen.height,
    cortes: [...cortes].filter(valido).sort((a, b) => a - b),
  };
}

/**
 * Descarga el elemento como PDF, con "Página X de Y" y la fecha en el pie.
 * Mientras se genera, el elemento debe tener la clase "formato--exportando"
 * (ancho fijo y sin botones), para que se vea igual en cualquier pantalla.
 */
export async function descargarPDF(
  elemento,
  nombreArchivo,
  { titulo = 'Historia clínica', formato = 'letter' } = {}
) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pdf = new jsPDF({
    unit: 'mm',
    format: formato,
    orientation: 'portrait',
  });
  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();
  const anchoUtil = anchoPagina - 2 * MARGEN;
  const altoUtil = altoPagina - MARGEN - MARGEN_INFERIOR;

  // Escala: cuántos píxeles de pantalla caben en una página
  const anchoPx = elemento.getBoundingClientRect().width;
  const pxPorMm = anchoPx / anchoUtil;
  const altoPaginaPx = altoUtil * pxPorMm;
  const { alto, cortes } = analizar(elemento, altoPaginaPx);

  const lienzo = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    scrollX: 0,
    scrollY: -window.scrollY,
  });
  const escala = lienzo.height / alto; // píxeles del lienzo por píxel de pantalla

  // Reparte el documento en páginas cortando en el corte seguro más bajo posible
  const tramos = [];
  let inicio = 0;
  while (inicio < alto - 1) {
    const limite = inicio + altoPaginaPx;
    const candidatos = cortes.filter((c) => c > inicio + 1 && c <= limite);
    const fin =
      limite >= alto ? alto : (candidatos.at(-1) ?? Math.min(limite, alto));
    tramos.push([inicio, fin]);
    inicio = fin;
  }

  tramos.forEach(([desde, hasta], i) => {
    if (i > 0) pdf.addPage();
    const trozo = document.createElement('canvas');
    trozo.width = lienzo.width;
    trozo.height = Math.round((hasta - desde) * escala);
    const ctx = trozo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, trozo.width, trozo.height);
    ctx.drawImage(
      lienzo,
      0,
      Math.round(desde * escala),
      lienzo.width,
      trozo.height,
      0,
      0,
      trozo.width,
      trozo.height
    );
    pdf.addImage(
      trozo.toDataURL('image/jpeg', 0.92),
      'JPEG',
      MARGEN,
      MARGEN,
      anchoUtil,
      (hasta - desde) / pxPorMm
    );
  });

  // Pie de página en todas las hojas
  const total = pdf.internal.getNumberOfPages();
  const generada = new Date().toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(
      `VetControl AI · ${titulo} · Generada el ${generada}`,
      MARGEN,
      altoPagina - 6
    );
    pdf.text(`Página ${i} de ${total}`, anchoPagina - MARGEN, altoPagina - 6, {
      align: 'right',
    });
  }
  pdf.save(nombreArchivo);
}

/** Nombre de archivo seguro: "HC-000001_Max.pdf" */
export const nombreArchivoHistoria = (numero, nombreMascota) =>
  `${numero}_${nombreMascota}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_') + '.pdf';
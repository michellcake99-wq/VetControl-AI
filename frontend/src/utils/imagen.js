const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ORIGINAL = 10 * 1024 * 1024; // 10 MB antes de reducirla

/**
 * Reduce una foto en el navegador antes de enviarla: la recorta en cuadrado,
 * la deja de `lado` x `lado` píxeles y la convierte a JPEG.
 * Así pesa poco (≈ 20-60 KB) y se puede guardar en la base de datos.
 * @returns {Promise<string>} data URL "data:image/jpeg;base64,…"
 */
export async function reducirImagen(archivo, lado = 400, calidad = 0.82) {
  if (!TIPOS.includes(archivo.type)) {
    throw new Error('La foto debe ser una imagen JPG, PNG o WebP.');
  }
  if (archivo.size > MAX_ORIGINAL) {
    throw new Error('La foto pesa más de 10 MB. Elige una más liviana.');
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((resolver, rechazar) => {
      const imagen = new Image();
      imagen.onload = () => resolver(imagen);
      imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
      imagen.src = url;
    });
    // Recorte cuadrado centrado (como una foto de perfil)
    const corte = Math.min(img.width, img.height);
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff'; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, lado, lado);
    ctx.drawImage(
      img,
      (img.width - corte) / 2,
      (img.height - corte) / 2,
      corte,
      corte,
      0,
      0,
      lado,
      lado
    );
    return lienzo.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

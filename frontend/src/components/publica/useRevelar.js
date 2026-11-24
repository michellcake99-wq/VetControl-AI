import { useEffect, useState } from 'react';

// Las tarjetas aparecen con una animación cuando entran en pantalla.
// Si el navegador no soporta IntersectionObserver o la persona pidió «reducir
// movimiento», no se oculta nada: todo se ve desde el principio.
const puedeAnimar = () =>
  typeof window !== 'undefined' &&
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Marca como visibles (clase `is-visible`) los elementos con el atributo
 * `data-revelar` cuando entran en pantalla. Devuelve `true` si la animación está activa.
 */
export default function useRevelar() {
  const [animar] = useState(puedeAnimar);

  useEffect(() => {
    if (!animar) return undefined;
    const elementos = document.querySelectorAll('.lp [data-revelar]');
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [animar]);

  return animar;
}

const _enc = new TextEncoder();

/**
 * Compara dos relativePaths byte a byte sobre su representación UTF-8.
 *
 * Equivalente exacto de `String::cmp` de Rust: ambos operan sobre bytes UTF-8
 * en orden lexicográfico. La diferencia con la comparación nativa de JavaScript
 * (<, >) es que JS compara code units UTF-16; para caracteres fuera del BMP
 * (U+10000+) los surrogados (~0xD800) son menores que caracteres BMP como
 * U+E000 (0xEE en UTF-8), invirtiendo el orden respecto a Rust.
 *
 * Regla: si todos los bytes compartidos son iguales, la ruta más corta gana.
 */
export function compareRelativePath(a: string, b: string): number {
  const ba = _enc.encode(a);
  const bb = _enc.encode(b);
  const len = Math.min(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    if (ba[i] !== bb[i]) return ba[i] < bb[i] ? -1 : 1;
  }
  return ba.length < bb.length ? -1 : ba.length > bb.length ? 1 : 0;
}

/**
 * Devuelve una copia del array ordenada por relativePath (orden UTF-8 ascendente).
 * Nunca muta el array recibido.
 */
export function sortMarkdownFilesByRelativePath<T extends { relativePath: string }>(
  files: readonly T[],
): T[] {
  return [...files].sort((a, b) => compareRelativePath(a.relativePath, b.relativePath));
}

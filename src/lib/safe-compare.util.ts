import { timingSafeEqual } from 'crypto';

// Comparación de strings resistente a timing attacks (API keys, firmas HMAC, etc.).
// Un `===` normal corta apenas encuentra el primer caracter distinto, lo que filtra
// por tiempo de respuesta cuánto del secreto acertó quien está probando a fuerza bruta.
export function safeEqual(value: string, expected: string): boolean {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

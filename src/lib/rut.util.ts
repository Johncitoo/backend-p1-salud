/**
 * Utilidad compartida para validación y formateo de RUT chileno.
 *
 * - validarRut(): algoritmo módulo 11
 * - formatearRut(): 211666234 → "21.166.623-4"
 * - limpiarRut():   "21.166.623-4" → "211666234"
 */

const DV_CHARS = '0123456789K';

/** Quita puntos, guiones y espacios. Devuelve solo dígitos + K (mayúscula). */
export function limpiarRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase();
}

/** Calcula el dígito verificador para un cuerpo numérico. Ej: 21166623 → "4" */
export function calcularDv(cuerpo: number): string {
  let suma = 0;
  let multiplicador = 2;

  while (cuerpo > 0) {
    suma += (cuerpo % 10) * multiplicador;
    cuerpo = Math.floor(cuerpo / 10);
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/**
 * Valida un RUT chileno.
 * Acepta formatos: 211666234, 21.166.623-4, 21166623-4, etc.
 */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;

  const cuerpo = parseInt(limpio.slice(0, -1), 10);
  const dv = limpio.slice(-1);

  return calcularDv(cuerpo) === dv;
}

/**
 * Formatea un RUT limpio (sin puntos ni guion) al formato 12.345.678-9.
 * Si ya viene con puntos/guion, lo limpia primero.
 */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return rut;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  // Insertar puntos cada 3 dígitos desde la derecha
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${conPuntos}-${dv}`;
}

/**
 * Normaliza y valida un RUT. Si es válido, devuelve el RUT formateado.
 * Si no es válido, lanza un error descriptivo.
 */
export function normalizarRut(rut: string): string {
  const trimmed = rut.trim();
  if (!trimmed) return trimmed;

  if (!validarRut(trimmed)) {
    throw new Error(`RUT "${rut}" no es válido (dígito verificador incorrecto)`);
  }

  return formatearRut(trimmed);
}

// Catálogo fijo de repuestos de mantenimiento preventivo. Los SKU deben coincidir
// con el inventario del Proyecto 5, ya que Proyecto 3 los usa para reservar stock.
// El técnico elige de esta lista al registrar una inspección (Paso 9).
export interface RepuestoCatalogo {
  sku: string;
  nombre: string;
  descripcion: string;
}

export const REPUESTOS_CATALOGO: RepuestoCatalogo[] = [
  { sku: 'FILTRO-HEPA-01', nombre: 'Filtro HEPA', descripcion: 'Filtro HEPA para concentrador de oxígeno' },
  { sku: 'BATERIA-RESPALDO-02', nombre: 'Batería de respaldo', descripcion: 'Batería de respaldo para equipo médico' },
  { sku: 'FILTRO-AIRE-03', nombre: 'Filtro de aire', descripcion: 'Filtro de aire de repuesto' },
  { sku: 'SENSOR-O2-04', nombre: 'Sensor de oxígeno', descripcion: 'Sensor de oxígeno de repuesto' },
  { sku: 'CABLE-PODER-05', nombre: 'Cable de poder', descripcion: 'Cable de alimentación de repuesto' },
];

export const REPUESTOS_POR_SKU = new Map<string, RepuestoCatalogo>(
  REPUESTOS_CATALOGO.map((r) => [r.sku, r]),
);

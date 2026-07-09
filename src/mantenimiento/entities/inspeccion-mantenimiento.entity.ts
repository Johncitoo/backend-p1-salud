import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Repuesto solicitado dentro de una inspección de mantenimiento. El `sku` debe
// existir en el catálogo (REPUESTOS_CATALOGO) y coincidir con el inventario del
// Proyecto 5, ya que Proyecto 3 lo usa para reservar stock.
export interface RepuestoSolicitado {
  sku: string;
  nombre: string;
  cantidad: number;
}

// Informe técnico de una inspección de mantenimiento preventivo (Paso 9). Al
// crearse, dispara el pedido automático de repuestos al Proyecto 3 (Paso 10);
// el resultado del webhook se guarda en estado / pedido_externo_id.
@Entity({ name: 'inspecciones_mantenimiento' })
export class InspeccionMantenimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string | null;

  // Equipo médico inspeccionado (ej. "Concentrador de oxígeno").
  @Column({ type: 'varchar', length: 150 })
  equipo: string;

  // Diagnóstico / informe técnico del profesional.
  @Column({ type: 'text', nullable: true })
  diagnostico?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'media' })
  prioridad: string;

  // Repuestos requeridos: [{ sku, nombre, cantidad }].
  @Column({ type: 'jsonb', default: '[]' })
  repuestos: RepuestoSolicitado[];

  // REGISTRADA | PEDIDO_ENVIADO | PEDIDO_RECHAZADO | FINALIZADA
  // FINALIZADA = se instalaron los componentes y se cerró la orden de trabajo (Paso 14).
  @Column({ type: 'varchar', length: 30, default: 'REGISTRADA' })
  estado: string;

  // ID del pedido generado por Proyecto 3 (pedido_id de la respuesta 201).
  @Column({ name: 'pedido_externo_id', type: 'varchar', length: 150, nullable: true })
  pedidoExternoId?: string | null;

  // Estado del pedido en Proyecto 3 (ej. "pendiente_preparacion") o "mock".
  @Column({ name: 'pedido_estado_externo', type: 'varchar', length: 60, nullable: true })
  pedidoEstadoExterno?: string | null;

  // Mensaje de error si el webhook falló (400/409/red).
  @Column({ name: 'pedido_error', type: 'text', nullable: true })
  pedidoError?: string | null;

  // Paso 14 (reemplazo de componentes): cuándo se registró la intervención y qué
  // se instaló. Al setearse, la orden de trabajo queda FINALIZADA.
  @Column({ name: 'intervencion_at', type: 'timestamp', nullable: true })
  intervencionAt?: Date | null;

  @Column({ name: 'intervencion_notas', type: 'text', nullable: true })
  intervencionNotas?: string | null;

  @Column({ name: 'creado_por_usuario_id', type: 'uuid', nullable: true })
  creadoPorUsuarioId?: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}

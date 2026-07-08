import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Registro local de cada solicitud de notificación aceptada por el Grupo 6 (HTTP 202),
// para poder consultar su estado de entrega despues via /tracking/:notificationId sin
// tener que guardar el notificationId "a mano" en cada lugar que dispara un evento.
@Entity({ name: 'notificaciones_enviadas' })
export class NotificacionEnviada {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  evento: string;

  @Column({ name: 'visita_id', type: 'uuid', nullable: true })
  visitaId?: string | null;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string | null;

  @Column({ name: 'destinatario_email', type: 'varchar', length: 255, nullable: true })
  destinatarioEmail?: string | null;

  @Column({ name: 'destinatario_telefono', type: 'varchar', length: 30, nullable: true })
  destinatarioTelefono?: string | null;

  @Column({ name: 'notification_id', type: 'varchar', length: 100 })
  notificationId: string;

  @Column({ name: 'job_id', type: 'varchar', length: 100, nullable: true })
  jobId?: string | null;

  // Copia local del ultimo estado conocido (pending/sent/failed/...), refrescado
  // bajo demanda contra /tracking/:notificationId. No hay webhook del Grupo 6 que
  // lo actualice solo.
  @Column({ type: 'varchar', length: 30, default: 'enviado' })
  estado: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt: Date;
}

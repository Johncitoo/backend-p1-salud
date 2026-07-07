import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Visita } from '../pacientes/entities/visita.entity';
import { IncidentesSaludService } from '../incidentes-salud/incidentes-salud.service';

@Injectable()
export class VisitasCronService {
  private readonly logger = new Logger(VisitasCronService.name);

  constructor(
    @InjectRepository(Visita)
    private readonly visitasRepository: Repository<Visita>,
    @Inject(forwardRef(() => IncidentesSaludService))
    private readonly incidentesSaludService: IncidentesSaludService,
  ) {}

  // Se ejecuta cada 15 minutos
  @Cron('*/15 * * * *')
  async checkLateVisits() {
    this.logger.log('Ejecutando Cron: Revisando visitas atrasadas...');
    
    // Calcular el timestamp de hace 60 minutos
    const umbralAtraso = new Date();
    umbralAtraso.setMinutes(umbralAtraso.getMinutes() - 60);

    try {
      // Para efectos prácticos y considerando que fechaProgramada y horaProgramada están separadas
      // usaremos checkInAt is null y combinaremos fecha y hora para la consulta (o simplemente
      // asumiremos que si la visita era de HOY y la hora ya pasó por más de 60 mins).
      // Para este MVP, buscaremos visitas que estén PROGRAMADA y tengan más de un cierto tiempo de creadas
      // o usaremos QueryBuilder.

      const visitasAtrasadas = await this.visitasRepository.createQueryBuilder('v')
        .where('v.estado = :estado', { estado: 'PROGRAMADA' })
        .andWhere('v.check_in_at IS NULL')
        // Concatenamos fecha y hora para comparar con el umbral
        .andWhere("CAST(CONCAT(v.fecha_programada, ' ', v.hora_programada) AS TIMESTAMP) < :umbral", { umbral: umbralAtraso })
        .getMany();

      if (visitasAtrasadas.length === 0) {
        this.logger.debug('No hay visitas atrasadas.');
        return;
      }

      this.logger.warn(`Se encontraron ${visitasAtrasadas.length} visitas con más de 60 minutos de atraso.`);

      for (const visita of visitasAtrasadas) {
        // 1. Crear el incidente clínico de severidad ALTA
        await this.incidentesSaludService.create({
          titulo: 'Visita No Registrada en Tiempo',
          descripcion: `El profesional no ha realizado check-in para la visita ${visita.id}. Excedió el umbral de 60 minutos.`,
          tipo: 'VISITA_NO_REGISTRADA',
          severidad: 'ALTA', // Esto gatilla la alerta al Proyecto 11
          estado: 'ABIERTO',
          origen: 'SISTEMA',
          pacienteId: visita.pacienteId,
          visitaId: visita.id,
        });

        // 2. Marcar la visita para que no vuelva a ser procesada por este cron
        // Le cambiamos el estado a 'CANCELADA' para cumplir con los constraints de BD
        visita.estado = 'CANCELADA';
        visita.observacionCancelacion = 'Marcada como atrasada por el sistema debido a inactividad > 60m';
        await this.visitasRepository.save(visita);
        
        this.logger.log(`Incidente generado y visita ${visita.id} actualizada a CANCELADA.`);
      }

    } catch (error) {
      this.logger.error(`Error en cron checkLateVisits: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateIncidenteEstadoHistorialDto } from './dto/create-incidente-estado-historial.dto';
import { IncidenteEstadoHistorial } from './entities/incidente-estado-historial.entity';

@Injectable()
export class IncidenteEstadoHistorialService {
  constructor(
    @InjectRepository(IncidenteEstadoHistorial)
    private readonly repository: Repository<IncidenteEstadoHistorial>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    incidenteSaludId?: string;
  }): Promise<IncidenteEstadoHistorial[]> {
    const qb = this.repository.createQueryBuilder('ieh');

    if (filtros?.incidenteSaludId)
      qb.where('ieh.incidente_salud_id = :incidenteSaludId', {
        incidenteSaludId: filtros.incidenteSaludId,
      });

    return qb.orderBy('ieh.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<IncidenteEstadoHistorial> {
    const registro = await this.repository.findOne({
      where: { id },
    });
    if (!registro)
      throw new NotFoundException(
        'Registro de historial de estado de incidente no encontrado',
      );
    return registro;
  }

  async create(
    dto: CreateIncidenteEstadoHistorialDto,
    usuarioId?: string,
  ): Promise<IncidenteEstadoHistorial> {
    const registro = this.repository.create({
      ...dto,
      cambiadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(registro);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'incidente_estado_historial',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Cambio de estado de incidente ${saved.incidenteSaludId}: ${saved.estadoAnterior ?? 'N/A'} -> ${saved.estadoNuevo}`,
    });

    return saved;
  }
}

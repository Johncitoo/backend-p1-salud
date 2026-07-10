import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateVisitaEstadoHistorialDto } from './dto/create-visita-estado-historial.dto';
import { VisitaEstadoHistorial } from './entities/visita-estado-historial.entity';

@Injectable()
export class VisitaEstadoHistorialService {
  constructor(
    @InjectRepository(VisitaEstadoHistorial)
    private readonly repository: Repository<VisitaEstadoHistorial>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    visitaId?: string;
  }): Promise<VisitaEstadoHistorial[]> {
    const qb = this.repository.createQueryBuilder('veh');

    if (filtros?.visitaId)
      qb.where('veh.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('veh.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<VisitaEstadoHistorial> {
    const registro = await this.repository.findOne({
      where: { id },
    });
    if (!registro)
      throw new NotFoundException(
        'Registro de historial de estado no encontrado',
      );
    return registro;
  }

  async create(
    dto: CreateVisitaEstadoHistorialDto,
    usuarioId?: string,
  ): Promise<VisitaEstadoHistorial> {
    const registro = this.repository.create({
      ...dto,
      cambiadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(registro);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visita_estado_historial',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Cambio de estado de visita ${saved.visitaId}: ${saved.estadoAnterior ?? 'N/A'} -> ${saved.estadoNuevo}`,
    });

    return saved;
  }
}

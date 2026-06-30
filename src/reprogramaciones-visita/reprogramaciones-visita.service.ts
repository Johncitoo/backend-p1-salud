import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateReprogramacionVisitaDto } from './dto/create-reprogramacion-visita.dto';
import { ReprogramacionVisita } from './entities/reprogramacion-visita.entity';

@Injectable()
export class ReprogramacionesVisitaService {
  constructor(
    @InjectRepository(ReprogramacionVisita)
    private readonly repository: Repository<ReprogramacionVisita>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    visitaId?: string;
  }): Promise<ReprogramacionVisita[]> {
    const qb = this.repository.createQueryBuilder('rv');

    if (filtros?.visitaId)
      qb.where('rv.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('rv.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<ReprogramacionVisita> {
    const reprogramacion = await this.repository.findOne({
      where: { id },
    });
    if (!reprogramacion) throw new NotFoundException('Reprogramacion de visita no encontrada');
    return reprogramacion;
  }

  async create(
    dto: CreateReprogramacionVisitaDto,
    usuarioId?: string,
  ): Promise<ReprogramacionVisita> {
    const reprogramacion = this.repository.create({
      ...dto,
      reprogramadaPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(reprogramacion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'reprogramaciones_visita',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Reprogramacion de visita ${saved.visitaId} creada`,
    });

    return saved;
  }
}

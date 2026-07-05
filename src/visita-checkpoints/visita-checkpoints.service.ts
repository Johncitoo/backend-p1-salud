import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateVisitaCheckpointDto } from './dto/create-visita-checkpoint.dto';
import { VisitaCheckpoint } from './entities/visita-checkpoint.entity';

@Injectable()
export class VisitaCheckpointsService {
  constructor(
    @InjectRepository(VisitaCheckpoint)
    private readonly repository: Repository<VisitaCheckpoint>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    visitaId?: string;
  }): Promise<VisitaCheckpoint[]> {
    const qb = this.repository.createQueryBuilder('vc');

    if (filtros?.visitaId)
      qb.where('vc.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('vc.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<VisitaCheckpoint> {
    const checkpoint = await this.repository.findOne({
      where: { id },
    });
    if (!checkpoint) throw new NotFoundException('Checkpoint de visita no encontrado');
    return checkpoint;
  }

  async create(
    dto: CreateVisitaCheckpointDto,
    usuarioId?: string,
  ): Promise<VisitaCheckpoint> {
    const checkpoint = this.repository.create({
      ...dto,
      origen: dto.origen ?? 'APP',
      registradoPorUsuarioId: usuarioId,
    });

    try {
      const saved = await this.repository.save(checkpoint);

      this.auditoriasService.registrar({
        usuarioId,
        entidad: 'visita_checkpoints',
        entidadId: saved.id,
        accion: 'CREAR',
        detalle: `Checkpoint ${saved.tipo} registrado para visita ${saved.visitaId}`,
      });

      return saved;
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`Ya existe un ${dto.tipo} para esta visita.`);
      }
      throw error;
    }
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateMotivoCancelacionDto } from './dto/create-motivo-cancelacion.dto';
import { UpdateMotivoCancelacionDto } from './dto/update-motivo-cancelacion.dto';
import { MotivoCancelacion } from './entities/motivo-cancelacion.entity';

@Injectable()
export class MotivosCancelacionService {
  constructor(
    @InjectRepository(MotivoCancelacion)
    private readonly repository: Repository<MotivoCancelacion>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(aplicaA?: string): Promise<MotivoCancelacion[]> {
    const qb = this.repository
      .createQueryBuilder('mc')
      .where('mc.deleted_at IS NULL');

    if (aplicaA) qb.andWhere('mc.aplica_a = :aplicaA', { aplicaA });

    return qb.orderBy('mc.nombre', 'ASC').getMany();
  }

  async findOne(id: string): Promise<MotivoCancelacion> {
    const motivo = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!motivo)
      throw new NotFoundException('Motivo de cancelación no encontrado');
    return motivo;
  }

  async create(dto: CreateMotivoCancelacionDto): Promise<MotivoCancelacion> {
    const motivo = this.repository.create({
      ...dto,
      aplicaA: dto.aplicaA ?? 'VISITA',
      requiereObservacion: dto.requiereObservacion ?? false,
      activo: dto.activo ?? true,
    });

    try {
      const saved = await this.repository.save(motivo);

      this.auditoriasService.registrar({
        entidad: 'motivos_cancelacion',
        entidadId: saved.id,
        accion: 'CREAR',
        detalle: `Motivo ${saved.codigo} - ${saved.nombre} creado`,
      });

      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException(`El código ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateMotivoCancelacionDto,
  ): Promise<MotivoCancelacion> {
    const motivo = await this.findOne(id);
    const oldValues = {
      codigo: motivo.codigo,
      nombre: motivo.nombre,
      activo: motivo.activo,
    };
    Object.assign(motivo, dto);

    try {
      const saved = await this.repository.save(motivo);

      this.auditoriasService.registrar({
        entidad: 'motivos_cancelacion',
        entidadId: saved.id,
        accion: 'ACTUALIZAR',
        detalle: `Motivo ${saved.codigo} actualizado`,
        oldValues,
        newValues: {
          codigo: saved.codigo,
          nombre: saved.nombre,
          activo: saved.activo,
        },
      });

      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException(`El código ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<MotivoCancelacion> {
    const motivo = await this.findOne(id);
    motivo.deletedAt = new Date();
    const saved = await this.repository.save(motivo);

    this.auditoriasService.registrar({
      entidad: 'motivos_cancelacion',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Motivo ${saved.codigo} eliminado (soft delete)`,
    });

    return saved;
  }
}

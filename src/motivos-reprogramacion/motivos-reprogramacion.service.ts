import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateMotivoReprogramacionDto } from './dto/create-motivo-reprogramacion.dto';
import { UpdateMotivoReprogramacionDto } from './dto/update-motivo-reprogramacion.dto';
import { MotivoReprogramacion } from './entities/motivo-reprogramacion.entity';

@Injectable()
export class MotivosReprogramacionService {
  constructor(
    @InjectRepository(MotivoReprogramacion)
    private readonly repository: Repository<MotivoReprogramacion>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(): Promise<MotivoReprogramacion[]> {
    return this.repository.find({
      where: { deletedAt: IsNull() },
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<MotivoReprogramacion> {
    const motivo = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!motivo) throw new NotFoundException('Motivo de reprogramación no encontrado');
    return motivo;
  }

  async create(dto: CreateMotivoReprogramacionDto): Promise<MotivoReprogramacion> {
    const motivo = this.repository.create({
      ...dto,
      requiereObservacion: dto.requiereObservacion ?? false,
      activo: dto.activo ?? true,
    });

    try {
      const saved = await this.repository.save(motivo);

      this.auditoriasService.registrar({
        entidad: 'motivos_reprogramacion',
        entidadId: saved.id,
        accion: 'CREAR',
        detalle: `Motivo ${saved.codigo} - ${saved.nombre} creado`,
      });

      return saved;
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`El código ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateMotivoReprogramacionDto): Promise<MotivoReprogramacion> {
    const motivo = await this.findOne(id);
    const oldValues = { codigo: motivo.codigo, nombre: motivo.nombre, activo: motivo.activo };
    Object.assign(motivo, dto);

    try {
      const saved = await this.repository.save(motivo);

      this.auditoriasService.registrar({
        entidad: 'motivos_reprogramacion',
        entidadId: saved.id,
        accion: 'ACTUALIZAR',
        detalle: `Motivo ${saved.codigo} actualizado`,
        oldValues,
        newValues: { codigo: saved.codigo, nombre: saved.nombre, activo: saved.activo },
      });

      return saved;
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`El código ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<MotivoReprogramacion> {
    const motivo = await this.findOne(id);
    motivo.deletedAt = new Date();
    const saved = await this.repository.save(motivo);

    this.auditoriasService.registrar({
      entidad: 'motivos_reprogramacion',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Motivo ${saved.codigo} eliminado (soft delete)`,
    });

    return saved;
  }
}

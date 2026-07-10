import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';
import { ReglaAsignacion } from './entities/regla-asignacion.entity';

@Injectable()
export class ReglasAsignacionService {
  constructor(
    @InjectRepository(ReglaAsignacion)
    private readonly repository: Repository<ReglaAsignacion>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: { activa?: boolean }): Promise<ReglaAsignacion[]> {
    const qb = this.repository
      .createQueryBuilder('ra')
      .where('ra.deleted_at IS NULL');

    if (filtros?.activa !== undefined)
      qb.andWhere('ra.activa = :activa', { activa: filtros.activa });

    return qb.orderBy('ra.prioridad', 'ASC').getMany();
  }

  async findOne(id: string): Promise<ReglaAsignacion> {
    const regla = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!regla)
      throw new NotFoundException('Regla de asignacion no encontrada');
    return regla;
  }

  async create(
    dto: CreateReglaAsignacionDto,
    usuarioId?: string,
  ): Promise<ReglaAsignacion> {
    const regla = this.repository.create({
      ...dto,
      prioridad: dto.prioridad ?? 100,
      condiciones: dto.condiciones ?? {},
      acciones: dto.acciones ?? {},
      activa: dto.activa ?? true,
    });

    try {
      const saved = await this.repository.save(regla);

      this.auditoriasService.registrar({
        usuarioId,
        entidad: 'reglas_asignacion',
        entidadId: saved.id,
        accion: 'CREAR',
        detalle: `Regla ${saved.codigo} - ${saved.nombre} creada`,
      });

      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException(`El codigo ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateReglaAsignacionDto,
    usuarioId?: string,
  ): Promise<ReglaAsignacion> {
    const regla = await this.findOne(id);
    const oldValues = {
      codigo: regla.codigo,
      nombre: regla.nombre,
      activa: regla.activa,
      prioridad: regla.prioridad,
    };
    Object.assign(regla, dto);

    try {
      const saved = await this.repository.save(regla);

      this.auditoriasService.registrar({
        usuarioId,
        entidad: 'reglas_asignacion',
        entidadId: saved.id,
        accion: 'ACTUALIZAR',
        detalle: `Regla ${saved.codigo} actualizada`,
        oldValues,
        newValues: {
          codigo: saved.codigo,
          nombre: saved.nombre,
          activa: saved.activa,
          prioridad: saved.prioridad,
        },
      });

      return saved;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException(`El codigo ${dto.codigo} ya existe.`);
      }
      throw error;
    }
  }

  async remove(id: string, usuarioId?: string): Promise<ReglaAsignacion> {
    const regla = await this.findOne(id);
    regla.deletedAt = new Date();
    const saved = await this.repository.save(regla);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'reglas_asignacion',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Regla ${saved.codigo} eliminada (soft delete)`,
    });

    return saved;
  }
}

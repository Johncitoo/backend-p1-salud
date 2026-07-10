import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { UpdateDisponibilidadDto } from './dto/update-disponibilidad.dto';
import { DisponibilidadProfesional } from './entities/disponibilidad-profesional.entity';

@Injectable()
export class DisponibilidadesService {
  constructor(
    @InjectRepository(DisponibilidadProfesional)
    private readonly repository: Repository<DisponibilidadProfesional>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(
    profesionalSaludId?: string,
  ): Promise<DisponibilidadProfesional[]> {
    const qb = this.repository
      .createQueryBuilder('d')
      .where('d.deleted_at IS NULL');
    if (profesionalSaludId)
      qb.andWhere('d.profesional_salud_id = :profesionalSaludId', {
        profesionalSaludId,
      });
    return qb
      .orderBy('d.dia_semana', 'ASC')
      .addOrderBy('d.hora_inicio', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<DisponibilidadProfesional> {
    const item = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!item) throw new NotFoundException('Disponibilidad no encontrada');
    return item;
  }

  async create(
    dto: CreateDisponibilidadDto,
  ): Promise<DisponibilidadProfesional> {
    const item = this.repository.create({ ...dto, activo: dto.activo ?? true });
    const saved = await this.repository.save(item);
    this.auditoriasService.registrar({
      entidad: 'disponibilidades_profesionales',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Disponibilidad día ${saved.diaSemana} ${saved.horaInicio}-${saved.horaFin} creada`,
    });
    return saved;
  }

  async update(
    id: string,
    dto: UpdateDisponibilidadDto,
  ): Promise<DisponibilidadProfesional> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    const saved = await this.repository.save(item);
    this.auditoriasService.registrar({
      entidad: 'disponibilidades_profesionales',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Disponibilidad actualizada`,
    });
    return saved;
  }

  async remove(id: string): Promise<DisponibilidadProfesional> {
    const item = await this.findOne(id);
    item.deletedAt = new Date();
    const saved = await this.repository.save(item);
    this.auditoriasService.registrar({
      entidad: 'disponibilidades_profesionales',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Disponibilidad eliminada (soft delete)`,
    });
    return saved;
  }
}

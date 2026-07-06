import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateBloqueoAgendaDto } from './dto/create-bloqueo-agenda.dto';
import { UpdateBloqueoAgendaDto } from './dto/update-bloqueo-agenda.dto';
import { BloqueoAgenda } from './entities/bloqueo-agenda.entity';

@Injectable()
export class BloqueosAgendaService {
  constructor(
    @InjectRepository(BloqueoAgenda)
    private readonly repository: Repository<BloqueoAgenda>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    tipo?: string;
    profesionalSaludId?: string;
    zonaId?: string;
    estado?: string;
  }): Promise<BloqueoAgenda[]> {
    const qb = this.repository
      .createQueryBuilder('ba')
      .where('ba.deleted_at IS NULL');

    if (filtros?.tipo)
      qb.andWhere('ba.tipo = :tipo', { tipo: filtros.tipo });
    if (filtros?.profesionalSaludId)
      qb.andWhere('ba.profesional_salud_id = :profesionalSaludId', {
        profesionalSaludId: filtros.profesionalSaludId,
      });
    if (filtros?.zonaId)
      qb.andWhere('ba.zona_id = :zonaId', { zonaId: filtros.zonaId });
    if (filtros?.estado)
      qb.andWhere('ba.estado = :estado', { estado: filtros.estado });

    return qb.orderBy('ba.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<BloqueoAgenda> {
    const bloqueo = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!bloqueo) throw new NotFoundException('Bloqueo de agenda no encontrado');
    return bloqueo;
  }

  async create(
    dto: CreateBloqueoAgendaDto,
    usuarioId?: string,
  ): Promise<BloqueoAgenda> {
    const bloqueo = this.repository.create({
      ...dto,
      estado: dto.estado ?? 'ACTIVO',
      creadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(bloqueo);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'bloqueos_agenda',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Bloqueo ${saved.tipo} creado (motivo: ${saved.motivo})`,
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateBloqueoAgendaDto,
    usuarioId?: string,
  ): Promise<BloqueoAgenda> {
    const bloqueo = await this.findOne(id);
    const oldValues = {
      tipo: bloqueo.tipo,
      estado: bloqueo.estado,
      motivo: bloqueo.motivo,
    };
    Object.assign(bloqueo, dto);

    const saved = await this.repository.save(bloqueo);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'bloqueos_agenda',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Bloqueo ${saved.tipo} actualizado`,
      oldValues,
      newValues: {
        tipo: saved.tipo,
        estado: saved.estado,
        motivo: saved.motivo,
      },
    });

    return saved;
  }

  async remove(id: string, usuarioId?: string): Promise<BloqueoAgenda> {
    const bloqueo = await this.findOne(id);
    bloqueo.deletedAt = new Date();
    const saved = await this.repository.save(bloqueo);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'bloqueos_agenda',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Bloqueo ${saved.tipo} eliminado (soft delete)`,
    });

    return saved;
  }
}

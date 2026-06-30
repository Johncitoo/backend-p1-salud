import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateIncidenteSaludDto } from './dto/create-incidente-salud.dto';
import { UpdateIncidenteSaludDto } from './dto/update-incidente-salud.dto';
import { IncidenteSalud } from './entities/incidente-salud.entity';

@Injectable()
export class IncidentesSaludService {
  constructor(
    @InjectRepository(IncidenteSalud)
    private readonly repository: Repository<IncidenteSalud>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    estado?: string;
    severidad?: string;
    pacienteId?: string;
    visitaId?: string;
  }): Promise<IncidenteSalud[]> {
    const qb = this.repository
      .createQueryBuilder('is')
      .where('is.deleted_at IS NULL');

    if (filtros?.estado)
      qb.andWhere('is.estado = :estado', { estado: filtros.estado });
    if (filtros?.severidad)
      qb.andWhere('is.severidad = :severidad', { severidad: filtros.severidad });
    if (filtros?.pacienteId)
      qb.andWhere('is.paciente_id = :pacienteId', { pacienteId: filtros.pacienteId });
    if (filtros?.visitaId)
      qb.andWhere('is.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('is.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<IncidenteSalud> {
    const incidente = await this.repository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!incidente) throw new NotFoundException('Incidente de salud no encontrado');
    return incidente;
  }

  async create(
    dto: CreateIncidenteSaludDto,
    usuarioId?: string,
  ): Promise<IncidenteSalud> {
    const incidente = this.repository.create({
      ...dto,
      severidad: dto.severidad ?? 'MEDIA',
      estado: dto.estado ?? 'ABIERTO',
      origen: dto.origen ?? 'SISTEMA',
      metadata: dto.metadata ?? {},
      creadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(incidente);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'incidentes_salud',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Incidente ${saved.tipo} - ${saved.titulo} creado (severidad: ${saved.severidad})`,
    });

    return saved;
  }

  async update(
    id: string,
    dto: UpdateIncidenteSaludDto,
    usuarioId?: string,
  ): Promise<IncidenteSalud> {
    const incidente = await this.findOne(id);
    const oldValues = {
      tipo: incidente.tipo,
      severidad: incidente.severidad,
      estado: incidente.estado,
      titulo: incidente.titulo,
    };
    Object.assign(incidente, dto);

    const saved = await this.repository.save(incidente);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'incidentes_salud',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Incidente ${saved.tipo} - ${saved.titulo} actualizado`,
      oldValues,
      newValues: {
        tipo: saved.tipo,
        severidad: saved.severidad,
        estado: saved.estado,
        titulo: saved.titulo,
      },
    });

    return saved;
  }

  async remove(id: string, usuarioId?: string): Promise<IncidenteSalud> {
    const incidente = await this.findOne(id);
    incidente.deletedAt = new Date();
    const saved = await this.repository.save(incidente);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'incidentes_salud',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Incidente ${saved.tipo} - ${saved.titulo} eliminado (soft delete)`,
    });

    return saved;
  }
}

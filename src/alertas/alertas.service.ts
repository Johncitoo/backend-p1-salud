import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { CreateAlertaDto } from './dto/create-alerta.dto';
import { UpdateAlertaDto } from './dto/update-alerta.dto';
import { Alerta } from './entities/alerta.entity';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertasRepository: Repository<Alerta>,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findAll(filtros?: {
    pacienteId?: string;
    visitaId?: string;
    estado?: string;
    prioridad?: string;
  }): Promise<Alerta[]> {
    const qb = this.alertasRepository
      .createQueryBuilder('alerta')
      .where('alerta.deleted_at IS NULL');

    if (filtros?.pacienteId)
      qb.andWhere('alerta.paciente_id = :pacienteId', {
        pacienteId: filtros.pacienteId,
      });
    if (filtros?.visitaId)
      qb.andWhere('alerta.visita_id = :visitaId', {
        visitaId: filtros.visitaId,
      });
    if (filtros?.estado)
      qb.andWhere('alerta.estado = :estado', { estado: filtros.estado });
    if (filtros?.prioridad)
      qb.andWhere('alerta.prioridad = :prioridad', {
        prioridad: filtros.prioridad,
      });

    return qb.orderBy('alerta.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Alerta> {
    const alerta = await this.alertasRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');
    return alerta;
  }

  async create(
    dto: CreateAlertaDto,
    usuarioId?: string,
  ): Promise<Alerta> {
    const alerta = this.alertasRepository.create({
      ...dto,
      prioridad: dto.prioridad ?? 'MEDIA',
      estado: dto.estado ?? 'ABIERTA',
    });

    const saved = await this.alertasRepository.save(alerta);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'alertas',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Alerta ${saved.tipo} creada (prioridad: ${saved.prioridad})`,
    });

    await this.analyticsService.sendAlertaUpsertEvent(saved);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateAlertaDto,
    usuarioId?: string,
  ): Promise<Alerta> {
    const alerta = await this.findOne(id);
    const oldValues = {
      tipo: alerta.tipo,
      prioridad: alerta.prioridad,
      estado: alerta.estado,
    };
    Object.assign(alerta, dto);

    const saved = await this.alertasRepository.save(alerta);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'alertas',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Alerta ${saved.tipo} actualizada`,
      oldValues,
      newValues: {
        tipo: saved.tipo,
        prioridad: saved.prioridad,
        estado: saved.estado,
      },
    });

    await this.analyticsService.sendAlertaUpsertEvent(saved);

    return saved;
  }

  async remove(id: string, usuarioId?: string): Promise<Alerta> {
    const alerta = await this.findOne(id);
    alerta.deletedAt = new Date();
    const saved = await this.alertasRepository.save(alerta);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'alertas',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Alerta ${saved.tipo} eliminada (soft delete)`,
    });

    return saved;
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { CreateVisitaDto } from '../pacientes/dto/create-visita.dto';
import { UpdateVisitaDto } from '../pacientes/dto/update-visita.dto';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { PlanCuidado } from '../pacientes/entities/plan-cuidado.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Zona } from '../zonas/entities/zona.entity';
import { CancelarVisitaDto } from './dto/cancelar-visita.dto';
import { CambiarEstadoVisitaDto } from './dto/cambiar-estado-visita.dto';
import { CompletarVisitaDto } from './dto/completar-visita.dto';
import { FindVisitasQueryDto } from './dto/find-visitas-query.dto';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';

const ESTADOS_VISITA = ['PROGRAMADA', 'EN_CAMINO', 'EN_ATENCION', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA', 'NO_REALIZADA'];

@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Visita)
    private readonly visitasRepository: Repository<Visita>,
    @InjectRepository(Paciente)
    private readonly pacientesRepository: Repository<Paciente>,
    @InjectRepository(ProfesionalSalud)
    private readonly profesionalesRepository: Repository<ProfesionalSalud>,
    @InjectRepository(Zona)
    private readonly zonasRepository: Repository<Zona>,
    @InjectRepository(PlanCuidado)
    private readonly planesRepository: Repository<PlanCuidado>,
    @InjectRepository(DireccionPaciente)
    private readonly direccionesRepository: Repository<DireccionPaciente>,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findAll(filtros: FindVisitasQueryDto = {}): Promise<Visita[]> {
    const qb = this.visitasRepository
      .createQueryBuilder('visita')
      .where('visita.deleted_at IS NULL');

    if (filtros.pacienteId) qb.andWhere('visita.paciente_id = :pacienteId', { pacienteId: filtros.pacienteId });
    if (filtros.profesionalSaludId) qb.andWhere('visita.profesional_salud_id = :profesionalSaludId', { profesionalSaludId: filtros.profesionalSaludId });
    if (filtros.zonaId) qb.andWhere('visita.zona_id = :zonaId', { zonaId: filtros.zonaId });
    if (filtros.estado) qb.andWhere('visita.estado = :estado', { estado: filtros.estado });
    if (filtros.fechaDesde) qb.andWhere('visita.fecha_programada >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    if (filtros.fechaHasta) qb.andWhere('visita.fecha_programada <= :fechaHasta', { fechaHasta: filtros.fechaHasta });

    return qb
      .orderBy('visita.fecha_programada', 'ASC')
      .addOrderBy('visita.hora_programada', 'ASC')
      .getMany();
  }

  async findAllForUser(filtros: FindVisitasQueryDto = {}, user?: UsuarioPerfil): Promise<Visita[]> {
    if (user?.rol !== 'PROFESIONAL') return this.findAll(filtros);

    const profesional = await this.profesionalesRepository.findOne({
      where: { usuarioId: user.id, deletedAt: IsNull() },
    });

    if (!profesional) return [];

    return this.findAll({
      ...filtros,
      profesionalSaludId: profesional.id,
    });
  }

  findByPaciente(pacienteId: string): Promise<Visita[]> {
    return this.findAll({ pacienteId });
  }

  async findOne(id: string): Promise<Visita> {
    const visita = await this.visitasRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!visita) throw new NotFoundException('Visita no encontrada');
    return visita;
  }

  async create(dto: CreateVisitaDto, usuarioId?: string): Promise<Visita> {
    if (!usuarioId) throw new BadRequestException('No se pudo identificar al usuario creador de la visita');

    await this.ensureReferences(dto);

    const visita = this.visitasRepository.create({
      ...dto,
      estado: dto.estado ?? 'PROGRAMADA',
      prioridad: dto.prioridad ?? 'NORMAL',
      creadaPorUsuarioId: usuarioId,
    });
    const saved = await this.visitasRepository.save(visita);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Visita programada para ${saved.fechaProgramada} ${saved.horaProgramada}`,
    });

    await this.analyticsService.sendVisitUpsertEvent(saved);

    return saved;
  }

  async update(id: string, dto: UpdateVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    await this.ensureReferences(dto);

    Object.assign(visita, dto);
    const saved = await this.visitasRepository.save(visita);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: 'Visita actualizada',
    });

    await this.analyticsService.sendVisitUpsertEvent(saved);

    return saved;
  }

  async cambiarEstado(id: string, dto: CambiarEstadoVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    const estadoAnterior = visita.estado;

    if (!ESTADOS_VISITA.includes(dto.estado)) {
      throw new BadRequestException('Estado de visita inválido');
    }

    visita.estado = dto.estado;
    if (dto.estado === 'EN_ATENCION' && !visita.fechaHoraInicioReal) visita.fechaHoraInicioReal = new Date();
    if (dto.estado === 'REALIZADA' && !visita.fechaHoraFinReal) visita.fechaHoraFinReal = new Date();

    const saved = await this.visitasRepository.save(visita);
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'CAMBIAR_ESTADO',
      detalle: `Visita cambió de ${estadoAnterior} a ${saved.estado}`,
    });

    await this.analyticsService.sendVisitUpsertEvent(saved, { puntual: dto.puntual });

    return saved;
  }

  async completar(id: string, dto: CompletarVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    const estadoAnterior = visita.estado;

    if (visita.estado === 'CANCELADA') throw new BadRequestException('No se puede completar una visita cancelada');
    if (!visita.fechaHoraInicioReal) visita.fechaHoraInicioReal = new Date();

    visita.estado = 'REALIZADA';
    visita.fechaHoraFinReal = visita.fechaHoraFinReal ?? new Date();

    const saved = await this.visitasRepository.save(visita);
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'COMPLETAR',
      detalle: `Visita completada desde ${estadoAnterior}`,
    });

    await this.analyticsService.sendVisitUpsertEvent(saved, { puntual: dto.puntual });

    return saved;
  }

  async cancelar(id: string, dto: CancelarVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    if (visita.estado === 'CANCELADA') throw new BadRequestException('La visita ya está cancelada');
    if (visita.estado === 'REALIZADA') throw new BadRequestException('No se puede cancelar una visita realizada');

    visita.estado = 'CANCELADA';
    visita.motivoCancelacionId = dto.motivoCancelacionId ?? null;
    visita.observacionCancelacion = dto.observacionCancelacion ?? null;
    visita.canceladaAt = new Date();
    visita.canceladaPorUsuarioId = usuarioId ?? null;

    const saved = await this.visitasRepository.save(visita);
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'CANCELAR',
      detalle: dto.observacionCancelacion ?? 'Visita cancelada',
    });

    await this.analyticsService.sendVisitUpsertEvent(saved);

    return saved;
  }

  async remove(id: string, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    visita.deletedAt = new Date();
    const saved = await this.visitasRepository.save(visita);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: 'Visita eliminada (soft delete)',
    });

    return saved;
  }

  private async ensureReferences(dto: Partial<CreateVisitaDto & UpdateVisitaDto>) {
    if (dto.pacienteId) {
      const exists = await this.pacientesRepository.exist({ where: { id: dto.pacienteId, deletedAt: IsNull() } });
      if (!exists) throw new NotFoundException('Paciente no encontrado');
    }

    if (dto.profesionalSaludId) {
      const exists = await this.profesionalesRepository.exist({ where: { id: dto.profesionalSaludId, deletedAt: IsNull() } });
      if (!exists) throw new NotFoundException('Profesional no encontrado');
    }

    if (dto.zonaId) {
      const exists = await this.zonasRepository.exist({ where: { id: dto.zonaId, deletedAt: IsNull() } });
      if (!exists) throw new NotFoundException('Zona no encontrada');
    }

    if (dto.planCuidadoId) {
      const exists = await this.planesRepository.exist({ where: { id: dto.planCuidadoId, deletedAt: IsNull() } });
      if (!exists) throw new NotFoundException('Plan de cuidado no encontrado');
    }

    if (dto.direccionPacienteId) {
      const exists = await this.direccionesRepository.exist({ where: { id: dto.direccionPacienteId, deletedAt: IsNull() } });
      if (!exists) throw new NotFoundException('Dirección de paciente no encontrada');
    }
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService, VisitAnalyticsOptions } from '../integrations/analytics/analytics.service';
import { NotificacionesService } from '../integrations/notificaciones/notificaciones.service';
import { CreateVisitaDto } from '../pacientes/dto/create-visita.dto';
import { UpdateVisitaDto } from '../pacientes/dto/update-visita.dto';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { PlanCuidado } from '../pacientes/entities/plan-cuidado.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Zona } from '../zonas/entities/zona.entity';
import { CancelarVisitaDto } from './dto/cancelar-visita.dto';
import { CambiarEstadoVisitaDto } from './dto/cambiar-estado-visita.dto';
import { FindCalendarioQueryDto } from './dto/find-calendario-query.dto';
import { CompletarVisitaDto } from './dto/completar-visita.dto';
import { FindVisitasQueryDto } from './dto/find-visitas-query.dto';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { GoogleCalendarSyncService } from '../google-calendar/services/google-calendar-sync.service';

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
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    private readonly auditoriasService: AuditoriasService,
    private readonly googleCalendarSyncService: GoogleCalendarSyncService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // Obtiene el paciente y el usuario del profesional de una visita, para enviar notificaciones.
  // Tolerante a fallos: si algo no se encuentra, retorna null en ese campo.
  private async obtenerContactosVisita(visita: Visita): Promise<{ paciente: Paciente | null; profesionalUsuario: Usuario | null }> {
    const paciente = await this.pacientesRepository.findOne({ where: { id: visita.pacienteId } });
    const profesional = await this.profesionalesRepository.findOne({ where: { id: visita.profesionalSaludId } });
    const profesionalUsuario = profesional
      ? await this.usuariosRepository.findOne({ where: { id: profesional.usuarioId } })
      : null;
    return { paciente, profesionalUsuario };
  }

  // El sistema no tiene un concepto propio de "tipo de visita"; usamos la profesión
  // del profesional asignado como equivalente, ya que es lo que Grupo 9 (Analítica)
  // requiere como campo obligatorio (visit_type) para construir la agenda del dashboard.
  private async obtenerVisitType(visita: Visita): Promise<string | null> {
    const profesional = await this.profesionalesRepository.findOne({ where: { id: visita.profesionalSaludId } });
    return profesional?.profesion ?? null;
  }

  // Antes de enviar el visita_upsert al Grupo 9 (Analítica), reenvía las dimensiones
  // que la visita referencia (usuario creador, paciente, profesional y zona). Su ETL
  // hace un INNER JOIN con sus tablas de dimensión y descarta la visita si alguna no
  // existe; eso ocurre cuando la entidad ya existía y nunca se envió en su creación
  // (p.ej. una zona o usuario creados antes de habilitar la integración). Los upsert
  // son idempotentes, así que reenviarlos no duplica nada en su dimensión.
  private async sincronizarVisitaAnalytics(visita: Visita, options: VisitAnalyticsOptions = {}): Promise<void> {
    const [paciente, profesional, zona] = await Promise.all([
      this.pacientesRepository.findOne({ where: { id: visita.pacienteId } }),
      this.profesionalesRepository.findOne({ where: { id: visita.profesionalSaludId } }),
      visita.zonaId
        ? this.zonasRepository.findOne({ where: { id: visita.zonaId } })
        : Promise.resolve(null),
    ]);
    const creador = visita.creadaPorUsuarioId
      ? await this.usuariosRepository.findOne({ where: { id: visita.creadaPorUsuarioId } })
      : null;

    if (creador) await this.analyticsService.sendUsuarioUpsertEvent(creador);
    if (paciente) await this.analyticsService.sendPacienteUpsertEvent(paciente);
    if (profesional) {
      const usuarioProfesional = await this.usuariosRepository.findOne({
        where: { id: profesional.usuarioId },
      });
      await this.analyticsService.sendProfesionalUpsertEvent(profesional, {
        nombres: usuarioProfesional?.nombres ?? '',
        apellidos: usuarioProfesional?.apellidos ?? '',
      });
    }
    if (zona) await this.analyticsService.sendZonaUpsertEvent(zona);

    await this.analyticsService.sendVisitUpsertEvent(visita, options);
  }

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

    await this.googleCalendarSyncService.syncCreatedVisit(saved);
    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
    await this.notificacionesService.notificarVisitaAgendada(saved, paciente, profesionalUsuario);

    return saved;
  }

  async findCalendarForUser(filtros: FindCalendarioQueryDto, user?: UsuarioPerfil) {
    const profesionalId = user?.rol === 'PROFESIONAL'
      ? (await this.profesionalesRepository.findOne({ where: { usuarioId: user.id, deletedAt: IsNull() } }))?.id
      : filtros.profesionalSaludId;

    if (user?.rol === 'PROFESIONAL' && !profesionalId) return [];

    const qb = this.visitasRepository
      .createQueryBuilder('visita')
      .leftJoin('pacientes', 'paciente', 'paciente.id = visita.paciente_id')
      .leftJoin('profesionales_salud', 'profesional', 'profesional.id = visita.profesional_salud_id')
      .leftJoin('usuarios', 'usuarioProfesional', 'usuarioProfesional.id = profesional.usuario_id')
      .leftJoin('zonas', 'zona', 'zona.id = visita.zona_id')
      .leftJoin('fichas_clinicas', 'ficha', 'ficha.visita_id = visita.id AND ficha.deleted_at IS NULL')
      .select([
        'visita.id AS "id"',
        'visita.estado AS "estado"',
        'visita.prioridad AS "prioridad"',
        'visita.fecha_programada AS "fechaProgramada"',
        'visita.hora_programada AS "horaProgramada"',
        'visita.duracion_estimada_min AS "duracionEstimadaMin"',
        'visita.paciente_id AS "pacienteId"',
        'paciente.nombres AS "pacienteNombres"',
        'paciente.apellidos AS "pacienteApellidos"',
        'visita.profesional_salud_id AS "profesionalSaludId"',
        'usuarioProfesional.nombres AS "profesionalNombres"',
        'usuarioProfesional.apellidos AS "profesionalApellidos"',
        'visita.zona_id AS "zonaId"',
        'zona.nombre AS "zonaNombre"',
        'ficha.id AS "fichaClinicaId"',
        'visita.google_calendar_sync_status AS "googleCalendarSyncStatus"',
        'visita.google_calendar_html_link AS "googleCalendarHtmlLink"',
        'visita.google_calendar_last_error AS "googleCalendarLastError"',
      ])
      .where('visita.deleted_at IS NULL')
      .andWhere('visita.fecha_programada BETWEEN :desde AND :hasta', { desde: filtros.desde, hasta: filtros.hasta });

    if (profesionalId) qb.andWhere('visita.profesional_salud_id = :profesionalId', { profesionalId });
    if (filtros.zonaId) qb.andWhere('visita.zona_id = :zonaId', { zonaId: filtros.zonaId });
    if (filtros.estado) qb.andWhere('visita.estado = :estado', { estado: filtros.estado });

    const rows = await qb
      .orderBy('visita.fecha_programada', 'ASC')
      .addOrderBy('visita.hora_programada', 'ASC')
      .getRawMany();

    return rows.map((row) => {
      const startTime = normalizeVisitaTime(row.horaProgramada);
      const end = addMinutesToDateTime(row.fechaProgramada, startTime, Number(row.duracionEstimadaMin ?? 60));

      return {
        ...row,
        startsAt: `${row.fechaProgramada}T${startTime}`,
        endsAt: `${end.date}T${end.time}`,
      };
    });
  }

  async update(id: string, dto: UpdateVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    const previousProfesionalSaludId = visita.profesionalSaludId;
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

    await this.googleCalendarSyncService.syncUpdatedVisit(saved, previousProfesionalSaludId);
    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    return saved;
  }

  async resyncGoogleCalendar(id: string, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    const saved = await this.googleCalendarSyncService.syncVisitNow(visita);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'REENVIAR_GOOGLE_CALENDAR',
      detalle: `Reintento de sincronizacion Google Calendar: ${saved.googleCalendarSyncStatus ?? 'SIN_CAMBIOS'}`,
    });

    return saved;
  }

  async findGoogleCalendarLogs(id: string) {
    await this.findOne(id);
    return this.googleCalendarSyncService.findLogsForVisit(id);
  }

  async retryPendingGoogleCalendarSync(usuarioId?: string) {
    const result = await this.googleCalendarSyncService.retryPendingVisits();

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: '00000000-0000-4000-8000-000000000000',
      accion: 'REENVIAR_GOOGLE_CALENDAR_PENDIENTES',
      detalle: `Reintento automatico/manual de Google Calendar: ${result.attempted} intentos, ${result.synced} ok, ${result.failed} fallidos`,
      newValues: result,
    });

    return result;
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

    await this.sincronizarVisitaAnalytics(saved, { puntual: dto.puntual, visitType: await this.obtenerVisitType(saved) });

    // Eventos de ciclo de vida complementarios al upsert
    if (dto.estado === 'EN_ATENCION') {
      await this.analyticsService.sendVisitaInicioEvent(saved);
    }
    if (dto.estado === 'REALIZADA') {
      await this.analyticsService.sendVisitaFinEvent(saved, { puntual: dto.puntual });
    }

    // Notificar reprogramación a paciente y profesional
    if (dto.estado === 'REPROGRAMADA') {
      const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
      await this.notificacionesService.notificarVisitaReprogramada(saved, paciente, profesionalUsuario);
    }

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

    await this.sincronizarVisitaAnalytics(saved, { puntual: dto.puntual, visitType: await this.obtenerVisitType(saved) });
    await this.analyticsService.sendVisitaFinEvent(saved, { puntual: dto.puntual });

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

    await this.googleCalendarSyncService.syncCanceledVisit(saved);
    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
    await this.notificacionesService.notificarVisitaCancelada(saved, paciente, profesionalUsuario);

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

    await this.googleCalendarSyncService.syncCanceledVisit(saved);

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

function normalizeVisitaTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function addMinutesToDateTime(date: string, time: string, minutes: number): { date: string; time: string } {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, mins, seconds] = time.split(':').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hours, mins, seconds ?? 0));
  start.setUTCMinutes(start.getUTCMinutes() + minutes);
  return {
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 19),
  };
}

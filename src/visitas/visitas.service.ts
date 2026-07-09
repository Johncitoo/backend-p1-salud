import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService, VisitAnalyticsOptions } from '../integrations/analytics/analytics.service';
import { NotificacionesService } from '../integrations/notificaciones/notificaciones.service';
import { PedidosService, PrescripcionItem } from '../integrations/pedidos/pedidos.service';
import { BloqueoAgenda } from '../bloqueos-agenda/entities/bloqueo-agenda.entity';
import { CreateVisitaDto } from '../pacientes/dto/create-visita.dto';
import { UpdateVisitaDto } from '../pacientes/dto/update-visita.dto';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Medicamento } from '../medicamentos/entities/medicamento.entity';
import { MedicamentoCatalogo } from '../medicamentos/entities/medicamento-catalogo.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { PlanCuidado } from '../pacientes/entities/plan-cuidado.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { Prestacion } from '../prestaciones/entities/prestacion.entity';
import { VisitaPrestacion } from '../prestaciones/entities/visita-prestacion.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { ReprogramacionVisita } from '../reprogramaciones-visita/entities/reprogramacion-visita.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { MotivoCancelacion } from '../motivos-cancelacion/entities/motivo-cancelacion.entity';
import { MotivoReprogramacion } from '../motivos-reprogramacion/entities/motivo-reprogramacion.entity';
import { Diagnostico } from '../diagnosticos/entities/diagnostico.entity';
import { VisitaEstadoHistorial } from '../visita-estado-historial/entities/visita-estado-historial.entity';
import { Zona } from '../zonas/entities/zona.entity';
import { CancelarVisitaDto } from './dto/cancelar-visita.dto';
import { CambiarEstadoVisitaDto } from './dto/cambiar-estado-visita.dto';
import { ReprogramarVisitaDto } from './dto/reprogramar-visita.dto';
import { FindCalendarioQueryDto } from './dto/find-calendario-query.dto';
import { CompletarVisitaDto } from './dto/completar-visita.dto';
import { InspeccionMantenimientoDto } from './dto/inspeccion-mantenimiento.dto';
import { FindVisitasQueryDto } from './dto/find-visitas-query.dto';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { GoogleCalendarSyncService } from '../google-calendar/services/google-calendar-sync.service';
import { IncidentesSaludService } from '../incidentes-salud/incidentes-salud.service';

const ESTADOS_VISITA = ['PROGRAMADA', 'EN_CAMINO', 'EN_ATENCION', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA', 'NO_REALIZADA'];
const ESTADOS_SIN_CONFLICTO = ['CANCELADA', 'REALIZADA', 'NO_REALIZADA'];

// Cancelación "tardía": se cancela faltando menos de este umbral para la hora
// programada → genera un incidente operacional (visit_cancelled_late en Grupo 11).
// Dentro de ese umbral, si falta menos de CRITICA_MIN se considera ALTA (muy cerca).
const CANCELACION_TARDIA_UMBRAL_MIN = 120; // 2 horas
const CANCELACION_TARDIA_ALTA_MIN = 60; // 1 hora
const VISITAS_TIME_ZONE = 'America/Santiago';

type VisitaScheduleSnapshot = {
  profesionalSaludId: string;
  zonaId?: string | null;
  fechaProgramada: string;
  horaProgramada: string;
  duracionEstimadaMin: number;
  estado?: string | null;
};

@Injectable()
export class VisitasService {
  private readonly logger = new Logger(VisitasService.name);

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
    @InjectRepository(ReprogramacionVisita)
    private readonly reprogramacionesRepository: Repository<ReprogramacionVisita>,
    @InjectRepository(BloqueoAgenda)
    private readonly bloqueosRepository: Repository<BloqueoAgenda>,
    @InjectRepository(VisitaEstadoHistorial)
    private readonly estadoHistorialRepository: Repository<VisitaEstadoHistorial>,
    @InjectRepository(VisitaPrestacion)
    private readonly visitaPrestacionesRepository: Repository<VisitaPrestacion>,
    @InjectRepository(MotivoCancelacion)
    private readonly motivosCancelacionRepository: Repository<MotivoCancelacion>,
    @InjectRepository(MotivoReprogramacion)
    private readonly motivosReprogramacionRepository: Repository<MotivoReprogramacion>,
    @InjectRepository(Medicamento)
    private readonly medicamentosRepository: Repository<Medicamento>,
    @InjectRepository(MedicamentoCatalogo)
    private readonly medicamentosCatalogoRepository: Repository<MedicamentoCatalogo>,
    @InjectRepository(Diagnostico)
    private readonly diagnosticosRepository: Repository<Diagnostico>,
    private readonly auditoriasService: AuditoriasService,
    private readonly googleCalendarSyncService: GoogleCalendarSyncService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificacionesService: NotificacionesService,
    @Inject(forwardRef(() => IncidentesSaludService))
    private readonly incidentesSaludService: IncidentesSaludService,
    private readonly pedidosService: PedidosService,
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
    await this.ensureAgendaDisponible({
      profesionalSaludId: dto.profesionalSaludId,
      zonaId: dto.zonaId,
      fechaProgramada: dto.fechaProgramada,
      horaProgramada: dto.horaProgramada,
      duracionEstimadaMin: dto.duracionEstimadaMin ?? 60,
      estado: dto.estado,
    });

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
    await this.registrarEstadoHistorial(saved, null, saved.estado, usuarioId, 'Visita creada');

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
      .leftJoin('direcciones_paciente', 'direccion', 'direccion.id = visita.direccion_paciente_id AND direccion.deleted_at IS NULL')
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
        'paciente.rut AS "pacienteRut"',
        'paciente.telefono AS "pacienteTelefono"',
        'paciente.direccion AS "pacienteDireccion"',
        'visita.profesional_salud_id AS "profesionalSaludId"',
        'usuarioProfesional.nombres AS "profesionalNombres"',
        'usuarioProfesional.apellidos AS "profesionalApellidos"',
        'profesional.profesion AS "profesionalProfesion"',
        'visita.zona_id AS "zonaId"',
        'zona.nombre AS "zonaNombre"',
        'visita.direccion_paciente_id AS "direccionPacienteId"',
        `NULLIF(CONCAT_WS(', ', NULLIF(CONCAT_WS(' ', direccion.calle, direccion.numero), ''), direccion.departamento, direccion.comuna, direccion.region), '') AS "direccionDetallada"`,
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

    const visitaIds = rows.map((row) => row.id);
    const prestacionesByVisita = new Map<string, Array<Record<string, unknown>>>();

    if (visitaIds.length > 0) {
      const prestaciones = await this.visitaPrestacionesRepository
        .createQueryBuilder('visitaPrestacion')
        .leftJoin(Prestacion, 'prestacion', 'prestacion.id = visitaPrestacion.prestacion_id')
        .select([
          'visitaPrestacion.visita_id AS "visitaId"',
          'visitaPrestacion.prestacion_id AS "prestacionId"',
          'visitaPrestacion.cantidad AS "cantidad"',
          'visitaPrestacion.estado AS "estado"',
          'visitaPrestacion.observacion AS "observacion"',
          'prestacion.codigo AS "codigo"',
          'prestacion.nombre AS "nombre"',
          'prestacion.duracion_estimada_min AS "duracionEstimadaMin"',
        ])
        .where('visitaPrestacion.deleted_at IS NULL')
        .andWhere('visitaPrestacion.visita_id IN (:...visitaIds)', { visitaIds })
        .orderBy('prestacion.nombre', 'ASC')
        .getRawMany();

      for (const prestacion of prestaciones) {
        const visitaId = prestacion.visitaId;
        const current = prestacionesByVisita.get(visitaId) ?? [];
        current.push({
          id: prestacion.prestacionId,
          codigo: prestacion.codigo,
          nombre: prestacion.nombre,
          cantidad: Number(prestacion.cantidad ?? 1),
          estado: prestacion.estado,
          observacion: prestacion.observacion,
          duracionEstimadaMin: prestacion.duracionEstimadaMin === null ? null : Number(prestacion.duracionEstimadaMin),
        });
        prestacionesByVisita.set(visitaId, current);
      }
    }

    return rows.map((row) => {
      const fechaProgramada = normalizeVisitaDate(row.fechaProgramada);
      const startTime = normalizeVisitaTime(row.horaProgramada);
      const end = addMinutesToDateTime(fechaProgramada, startTime, Number(row.duracionEstimadaMin ?? 60));

      return {
        ...row,
        fechaProgramada,
        direccion: row.direccionDetallada ?? row.pacienteDireccion ?? null,
        prestaciones: prestacionesByVisita.get(row.id) ?? [],
        startsAt: `${fechaProgramada}T${startTime}`,
        endsAt: `${end.date}T${end.time}`,
      };
    });
  }

  async update(id: string, dto: UpdateVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    const previous = this.snapshotVisita(visita);
    await this.ensureReferences(dto);

    const candidate = {
      profesionalSaludId: dto.profesionalSaludId ?? visita.profesionalSaludId,
      zonaId: dto.zonaId ?? visita.zonaId,
      fechaProgramada: dto.fechaProgramada ?? normalizeVisitaDate(visita.fechaProgramada),
      horaProgramada: dto.horaProgramada ?? visita.horaProgramada,
      duracionEstimadaMin: dto.duracionEstimadaMin ?? visita.duracionEstimadaMin ?? 60,
      estado: dto.estado ?? visita.estado,
    };

    await this.ensureAgendaDisponible(candidate, visita.id);
    const isReprogramacion = this.isReprogramacion(previous, candidate);
    const estadoAnterior = visita.estado;

    Object.assign(visita, dto);
    const saved = await this.visitasRepository.save(visita);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: isReprogramacion ? 'REPROGRAMAR' : 'ACTUALIZAR',
      detalle: isReprogramacion ? 'Visita reprogramada' : 'Visita actualizada',
    });

    if (estadoAnterior !== saved.estado) {
      await this.registrarEstadoHistorial(saved, estadoAnterior, saved.estado, usuarioId, 'Cambio desde edicion de visita');
    }

    if (isReprogramacion) {
      await this.registrarReprogramacion(saved, previous, usuarioId);
    }

    await this.googleCalendarSyncService.syncUpdatedVisit(saved, previous.profesionalSaludId);
    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    if (isReprogramacion) {
      const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
      await this.notificacionesService.notificarVisitaReprogramada(saved, paciente, profesionalUsuario);
    }

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
    await this.registrarEstadoHistorial(saved, estadoAnterior, saved.estado, usuarioId, 'Cambio de estado');

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
      const motivo = await this.resolverMotivoReprogramacion(dto.motivoReprogramacionId, dto.observacion);
      await this.notificacionesService.notificarVisitaReprogramada(saved, paciente, profesionalUsuario, motivo);
    }

    // Notificar al paciente que el profesional va en camino
    if (dto.estado === 'EN_CAMINO') {
      const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
      await this.notificacionesService.notificarProfesionalEnCamino(saved, paciente, profesionalUsuario);
    }

    return saved;
  }

  async reprogramar(id: string, dto: ReprogramarVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    if (['CANCELADA', 'REALIZADA'].includes(visita.estado)) {
      throw new BadRequestException('No se puede reprogramar una visita cancelada o realizada');
    }

    const estadoAnterior = visita.estado;
    const fechaAnterior = visita.fechaProgramada;
    const horaAnterior = visita.horaProgramada;

    visita.fechaProgramada = dto.fechaProgramadaNueva;
    visita.horaProgramada = dto.horaProgramadaNueva;
    visita.estado = 'PROGRAMADA';

    const saved = await this.visitasRepository.save(visita);

    await this.reprogramacionesRepository.save(
      this.reprogramacionesRepository.create({
        visitaId: saved.id,
        fechaProgramadaAnterior: fechaAnterior,
        horaProgramadaAnterior: horaAnterior,
        fechaProgramadaNueva: dto.fechaProgramadaNueva,
        horaProgramadaNueva: dto.horaProgramadaNueva,
        motivoReprogramacionId: dto.motivoReprogramacionId ?? null,
        observacion: dto.observacion ?? null,
        reprogramadaPorUsuarioId: usuarioId,
      }),
    );

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visitas',
      entidadId: saved.id,
      accion: 'REPROGRAMAR',
      detalle: `Visita reprogramada de ${fechaAnterior} ${horaAnterior} a ${dto.fechaProgramadaNueva} ${dto.horaProgramadaNueva}`,
    });
    await this.registrarEstadoHistorial(saved, estadoAnterior, saved.estado, usuarioId, 'Visita reprogramada');

    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
    const motivo = await this.resolverMotivoReprogramacion(dto.motivoReprogramacionId, dto.observacion);
    await this.notificacionesService.notificarVisitaReprogramada(saved, paciente, profesionalUsuario, motivo);

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
    await this.registrarEstadoHistorial(saved, estadoAnterior, saved.estado, usuarioId, 'Visita completada');

    await this.sincronizarVisitaAnalytics(saved, { puntual: dto.puntual, visitType: await this.obtenerVisitType(saved) });
    await this.analyticsService.sendVisitaFinEvent(saved, { puntual: dto.puntual });
    await this.enviarPedidoKitSiCorresponde(saved);

    return saved;
  }

  // Proyecto 3 (Gestión de Pedidos): al completar una visita, si quedaron
  // medicamentos registrados se le arma un pedido de kit clínico domiciliario.
  // Requiere email del paciente (Proyecto 3 lo usa como CustomerID); si no hay
  // email, se omite el envío sin bloquear el flujo clínico — solo se loguea
  // para que Coordinación lo note después. Ver CONTRATO_API_PRESCRIPCIONES.md.
  private async enviarPedidoKitSiCorresponde(visita: Visita): Promise<void> {
    const medicamentos = await this.medicamentosRepository.find({
      where: { visitaId: visita.id, deletedAt: IsNull() },
    });
    if (medicamentos.length === 0) return;

    const paciente = await this.pacientesRepository.findOne({ where: { id: visita.pacienteId } });
    if (!paciente?.email) {
      this.logger.warn(`No se envía pedido de kit a Proyecto 3 para visita ${visita.id}: paciente sin email.`);
      return;
    }

    const direccion = visita.direccionPacienteId
      ? await this.direccionesRepository.findOne({ where: { id: visita.direccionPacienteId } })
      : null;

    const catalogoIds = [...new Set(medicamentos.map(m => m.medicamentoCatalogoId).filter((id): id is string => !!id))];
    const catalogos = catalogoIds.length
      ? await this.medicamentosCatalogoRepository.findBy({ id: In(catalogoIds) })
      : [];
    const catalogoPorId = new Map(catalogos.map(c => [c.id, c]));

    const items = medicamentos.map(m => {
      const catalogo = m.medicamentoCatalogoId ? catalogoPorId.get(m.medicamentoCatalogoId) : undefined;
      const nombre = catalogo?.presentacion ? `${m.nombre} ${catalogo.presentacion}` : m.nombre;
      return { nombre, cantidad: m.cantidadCajas };
    });

    const payload = this.pedidosService.buildPayload(visita, paciente, direccion, items);
    await this.pedidosService.enviarPedido(payload);
  }

  // Envía un pedido a Proyecto 3 con una lista explícita de ítems (repuestos o
  // medicamentos). Mismo patrón tolerante a fallos: si el cliente no tiene email
  // (CustomerID) se omite el envío sin bloquear el flujo — solo se loguea.
  private async enviarPedidoRepuestos(visita: Visita, items: PrescripcionItem[]): Promise<void> {
    if (items.length === 0) return;

    const paciente = await this.pacientesRepository.findOne({ where: { id: visita.pacienteId } });
    if (!paciente?.email) {
      this.logger.warn(`No se envía pedido de repuestos a Proyecto 3 para visita ${visita.id}: cliente sin email.`);
      return;
    }

    const direccion = visita.direccionPacienteId
      ? await this.direccionesRepository.findOne({ where: { id: visita.direccionPacienteId } })
      : null;

    const payload = this.pedidosService.buildPayload(visita, paciente, direccion, items);
    await this.pedidosService.enviarPedido(payload);
  }

  // Paso 9 del UAT: el técnico registra la inspección de mantenimiento del
  // equipo. Guarda el diagnóstico (informe técnico), deja la visita EN_ATENCION,
  // emite MaintenanceInspectionCompleted (Analytics → BI, Proyecto 9) y dispara
  // automáticamente el pedido de repuestos a Proyecto 3 (Paso 10, sin
  // intervención manual). Un fallo en las integraciones no revierte el
  // diagnóstico ya guardado.
  async registrarInspeccionMantenimiento(
    id: string,
    dto: InspeccionMantenimientoDto,
    usuarioId?: string,
  ): Promise<Diagnostico> {
    const visita = await this.findOne(id);

    if (visita.estado === 'CANCELADA' || visita.estado === 'REALIZADA') {
      throw new BadRequestException(
        `No se puede registrar una inspección sobre una visita ${visita.estado}`,
      );
    }

    // El técnico llegó y está atendiendo el equipo en terreno.
    if (visita.estado === 'PROGRAMADA' || visita.estado === 'EN_CAMINO') {
      const estadoAnterior = visita.estado;
      visita.estado = 'EN_ATENCION';
      if (!visita.fechaHoraInicioReal) visita.fechaHoraInicioReal = new Date();
      await this.visitasRepository.save(visita);
      await this.registrarEstadoHistorial(
        visita,
        estadoAnterior,
        visita.estado,
        usuarioId,
        'Inicio de inspección de mantenimiento',
      );
    }

    const diagnostico = await this.diagnosticosRepository.save(
      this.diagnosticosRepository.create({
        visitaId: visita.id,
        descripcion: dto.diagnostico,
        creadoPorUsuarioId: usuarioId,
      }),
    );

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'diagnosticos',
      entidadId: diagnostico.id,
      accion: 'INSPECCION_MANTENIMIENTO',
      detalle: `Inspección de mantenimiento con ${dto.repuestos.length} repuesto(s) para visita ${visita.id}`,
    });

    await this.analyticsService.sendInspeccionMantenimientoEvent(visita, {
      repuestosCount: dto.repuestos.length,
    });

    await this.enviarPedidoRepuestos(
      visita,
      dto.repuestos.map(r => ({ nombre: r.nombre, cantidad: r.cantidad })),
    );

    return diagnostico;
  }

  async cancelar(id: string, dto: CancelarVisitaDto, usuarioId?: string): Promise<Visita> {
    const visita = await this.findOne(id);
    if (visita.estado === 'CANCELADA') throw new BadRequestException('La visita ya está cancelada');
    if (visita.estado === 'REALIZADA') throw new BadRequestException('No se puede cancelar una visita realizada');

    const estadoAnterior = visita.estado;
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
    await this.registrarEstadoHistorial(saved, estadoAnterior, saved.estado, usuarioId, 'Visita cancelada', dto.observacionCancelacion);

    await this.googleCalendarSyncService.syncCanceledVisit(saved);
    await this.sincronizarVisitaAnalytics(saved, { visitType: await this.obtenerVisitType(saved) });

    const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(saved);
    const motivo = await this.resolverMotivoCancelacion(dto.motivoCancelacionId, dto.observacionCancelacion);
    await this.notificacionesService.notificarVisitaCancelada(saved, paciente, profesionalUsuario, motivo);

    await this.registrarCancelacionTardiaSiCorresponde(saved, motivo, usuarioId);

    return saved;
  }

  // Si la visita se cancela faltando poco para su hora programada, genera un
  // incidente operacional (que se escala a Grupo 11 como visit_cancelled_late).
  // Tolerante a fallos: nunca interrumpe la cancelación.
  private async registrarCancelacionTardiaSiCorresponde(
    visita: Visita,
    motivo: string | null,
    usuarioId?: string,
  ): Promise<void> {
    try {
      if (!visita.fechaProgramada || !visita.horaProgramada) return;

      const horaProgramada = buildDateInTimeZone(
        normalizeVisitaDate(visita.fechaProgramada),
        normalizeVisitaTime(visita.horaProgramada),
        VISITAS_TIME_ZONE,
      );
      if (Number.isNaN(horaProgramada.getTime())) return;

      const canceladaAt = visita.canceladaAt ?? new Date();
      const minutosRestantes = Math.round((horaProgramada.getTime() - canceladaAt.getTime()) / 60_000);

      // Solo es "tardía" si falta menos del umbral (incluye visitas ya vencidas).
      if (minutosRestantes >= CANCELACION_TARDIA_UMBRAL_MIN) return;

      const severidad = minutosRestantes < CANCELACION_TARDIA_ALTA_MIN ? 'ALTA' : 'MEDIA';
      const detalleTiempo =
        minutosRestantes >= 0
          ? `faltando ${minutosRestantes} minutos para su hora programada`
          : `cuando ya habían pasado ${Math.abs(minutosRestantes)} minutos de su hora programada`;

      await this.incidentesSaludService.create(
        {
          titulo: 'Visita cancelada con poca anticipación',
          descripcion: `La visita ${visita.id} fue cancelada ${detalleTiempo}.${motivo ? ` Motivo: ${motivo}.` : ''}`,
          tipo: 'VISITA_CANCELADA_TARDIA',
          severidad,
          estado: 'ABIERTO',
          origen: 'SISTEMA',
          pacienteId: visita.pacienteId,
          visitaId: visita.id,
          profesionalSaludId: visita.profesionalSaludId,
        },
        usuarioId,
      );

      this.logger.log(
        `Incidente VISITA_CANCELADA_TARDIA (${severidad}) generado para la visita ${visita.id} (${minutosRestantes} min).`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar incidente de cancelación tardía para la visita ${visita.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Arma el texto del motivo para el correo: nombre del motivo catalogado (si se
  // envió uno) + observación libre, cuando existan. Ninguno es obligatorio.
  private async resolverMotivoCancelacion(motivoCancelacionId?: string, observacion?: string): Promise<string | null> {
    const partes: string[] = [];
    if (motivoCancelacionId) {
      const motivo = await this.motivosCancelacionRepository.findOne({ where: { id: motivoCancelacionId } });
      if (motivo) partes.push(motivo.nombre);
    }
    if (observacion) partes.push(observacion);
    return partes.length > 0 ? partes.join(' — ') : null;
  }

  private async resolverMotivoReprogramacion(motivoReprogramacionId?: string, observacion?: string): Promise<string | null> {
    const partes: string[] = [];
    if (motivoReprogramacionId) {
      const motivo = await this.motivosReprogramacionRepository.findOne({ where: { id: motivoReprogramacionId } });
      if (motivo) partes.push(motivo.nombre);
    }
    if (observacion) partes.push(observacion);
    return partes.length > 0 ? partes.join(' — ') : null;
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

    await this.registrarEstadoHistorial(saved, saved.estado, saved.estado, usuarioId, 'ELIMINADA', 'Visita eliminada (soft delete)');
    await this.googleCalendarSyncService.syncCanceledVisit(saved);

    return saved;
  }

  private snapshotVisita(visita: Visita): VisitaScheduleSnapshot {
    return {
      profesionalSaludId: visita.profesionalSaludId,
      zonaId: visita.zonaId,
      fechaProgramada: normalizeVisitaDate(visita.fechaProgramada),
      horaProgramada: normalizeVisitaTime(visita.horaProgramada),
      duracionEstimadaMin: Number(visita.duracionEstimadaMin ?? 60),
      estado: visita.estado,
    };
  }

  private isReprogramacion(previous: VisitaScheduleSnapshot, current: VisitaScheduleSnapshot): boolean {
    return (
      previous.profesionalSaludId !== current.profesionalSaludId ||
      previous.zonaId !== current.zonaId ||
      previous.fechaProgramada !== normalizeVisitaDate(current.fechaProgramada) ||
      previous.horaProgramada !== normalizeVisitaTime(current.horaProgramada) ||
      Number(previous.duracionEstimadaMin) !== Number(current.duracionEstimadaMin ?? 60)
    );
  }

  private async ensureAgendaDisponible(schedule: VisitaScheduleSnapshot, excludeVisitId?: string): Promise<void> {
    if (schedule.estado && ESTADOS_SIN_CONFLICTO.includes(schedule.estado)) return;

    const fechaProgramada = normalizeVisitaDate(schedule.fechaProgramada);
    const horaProgramada = normalizeVisitaTime(schedule.horaProgramada);
    const duracionEstimadaMin = Number(schedule.duracionEstimadaMin ?? 60);
    const startAt = toSqlTimestamp(fechaProgramada, horaProgramada);
    const end = addMinutesToDateTime(fechaProgramada, horaProgramada, duracionEstimadaMin);
    const endAt = toSqlTimestamp(end.date, end.time);

    const visitasQb = this.visitasRepository
      .createQueryBuilder('visita')
      .where('visita.deleted_at IS NULL')
      .andWhere('visita.profesional_salud_id = :profesionalSaludId', { profesionalSaludId: schedule.profesionalSaludId })
      .andWhere('visita.estado NOT IN (:...estadosSinConflicto)', { estadosSinConflicto: ESTADOS_SIN_CONFLICTO })
      .andWhere('visita.fecha_programada = :fechaProgramada', { fechaProgramada })
      .andWhere('(visita.fecha_programada + visita.hora_programada) < :endAt', { endAt })
      .andWhere("((visita.fecha_programada + visita.hora_programada) + (COALESCE(visita.duracion_estimada_min, 60) * INTERVAL '1 minute')) > :startAt", { startAt });

    if (excludeVisitId) visitasQb.andWhere('visita.id <> :excludeVisitId', { excludeVisitId });

    const visitaConflicto = await visitasQb.getOne();
    if (visitaConflicto) {
      throw new BadRequestException('El profesional ya tiene una visita programada en ese horario.');
    }

    const bloqueosQb = this.bloqueosRepository
      .createQueryBuilder('bloqueo')
      .where('bloqueo.deleted_at IS NULL')
      .andWhere('bloqueo.estado = :estado', { estado: 'ACTIVO' })
      .andWhere('bloqueo.fecha_hora_inicio < :endAt', { endAt })
      .andWhere('bloqueo.fecha_hora_fin > :startAt', { startAt })
      .andWhere(
        schedule.zonaId
          ? '(bloqueo.profesional_salud_id = :profesionalSaludId OR bloqueo.zona_id = :zonaId OR (bloqueo.profesional_salud_id IS NULL AND bloqueo.zona_id IS NULL))'
          : '(bloqueo.profesional_salud_id = :profesionalSaludId OR (bloqueo.profesional_salud_id IS NULL AND bloqueo.zona_id IS NULL))',
        { profesionalSaludId: schedule.profesionalSaludId, zonaId: schedule.zonaId },
      );

    const bloqueoConflicto = await bloqueosQb.getOne();

    if (bloqueoConflicto) {
      throw new BadRequestException('El profesional tiene un bloqueo de agenda en ese horario.');
    }
  }

  private async registrarReprogramacion(visita: Visita, previous: VisitaScheduleSnapshot, usuarioId?: string): Promise<void> {
    const reprogramadaPorUsuarioId = usuarioId ?? visita.creadaPorUsuarioId;
    if (!reprogramadaPorUsuarioId) return;

    await this.reprogramacionesRepository.save(
      this.reprogramacionesRepository.create({
        visitaId: visita.id,
        fechaProgramadaAnterior: previous.fechaProgramada,
        horaProgramadaAnterior: previous.horaProgramada,
        fechaProgramadaNueva: normalizeVisitaDate(visita.fechaProgramada),
        horaProgramadaNueva: normalizeVisitaTime(visita.horaProgramada),
        observacion: 'Reprogramacion generada desde edicion de visita',
        reprogramadaPorUsuarioId,
      }),
    );
  }

  private async registrarEstadoHistorial(
    visita: Visita,
    estadoAnterior: string | null,
    estadoNuevo: string,
    usuarioId?: string,
    motivo?: string | null,
    observacion?: string | null,
  ): Promise<void> {
    const cambiadoPorUsuarioId = usuarioId ?? visita.creadaPorUsuarioId;
    if (!cambiadoPorUsuarioId) return;

    await this.estadoHistorialRepository.save(
      this.estadoHistorialRepository.create({
        visitaId: visita.id,
        estadoAnterior,
        estadoNuevo,
        motivo: motivo ?? null,
        observacion: observacion ?? null,
        cambiadoPorUsuarioId,
      }),
    );
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

  // Recordatorio "un día antes" de la cita (fase 2 de la integración con Grupo 6,
  // ver docs/INTEGRACION-NOTIFICACIONES-GRUPO6.md). Corre todos los días a las 09:00,
  // hora del servidor, y notifica a paciente y profesional de las visitas de mañana
  // que sigan en un estado "activo" (no canceladas/reprogramadas/no realizadas).
  @Cron('0 9 * * *')
  async enviarRecordatoriosDelDiaSiguiente(): Promise<void> {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fecha = manana.toISOString().slice(0, 10);

    const visitas = await this.visitasRepository.find({
      where: { fechaProgramada: fecha, deletedAt: IsNull() },
    });

    const activas = visitas.filter(
      v => !ESTADOS_SIN_CONFLICTO.includes(v.estado) && v.estado !== 'REPROGRAMADA',
    );

    for (const visita of activas) {
      const { paciente, profesionalUsuario } = await this.obtenerContactosVisita(visita);
      await this.notificacionesService.notificarRecordatorioVisita(visita, paciente, profesionalUsuario);
    }

    this.logger.log(`Recordatorios del día siguiente (${fecha}): ${activas.length} visita(s) notificadas.`);
  }
}

function normalizeVisitaTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function normalizeVisitaDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
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

function toSqlTimestamp(date: string, time: string): string {
  return `${date} ${normalizeVisitaTime(time)}`;
}

function buildDateInTimeZone(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes, seconds] = normalizeVisitaTime(time).split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, seconds ?? 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstPass = utcGuess - offset;
  const correctedOffset = getTimeZoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(utcGuess - correctedOffset);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  );

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return asUtc - date.getTime();
}

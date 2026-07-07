import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CrmService } from '../integrations/crm/crm.service';
import { IncidentesService } from '../integrations/incidentes/incidentes.service';
import { PacientesService } from '../pacientes/pacientes.service';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CreateIncidenteSaludDto } from './dto/create-incidente-salud.dto';
import { UpdateIncidenteSaludDto } from './dto/update-incidente-salud.dto';
import { IncidenteSalud } from './entities/incidente-salud.entity';

@Injectable()
export class IncidentesSaludService {
  private readonly logger = new Logger(IncidentesSaludService.name);

  constructor(
    @InjectRepository(IncidenteSalud)
    private readonly repository: Repository<IncidenteSalud>,
    @InjectRepository(Visita)
    private readonly visitaRepository: Repository<Visita>,
    @InjectRepository(ProfesionalSalud)
    private readonly profesionalRepository: Repository<ProfesionalSalud>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly auditoriasService: AuditoriasService,
    private readonly crmService: CrmService,
    private readonly incidentesService: IncidentesService,
    private readonly pacientesService: PacientesService,
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

  async findCrmStatus(id: string) {
    const incidente = await this.findOne(id);

    if (!incidente.externalIncidentId) {
      return {
        id: incidente.id,
        externalIncidentId: null,
        titulo: incidente.titulo,
        descripcion: incidente.descripcion,
        estado: incidente.estado,
        severidad: incidente.severidad,
        sincronizado: false,
        mensaje: 'Incidente sin ticket asociado en CRM',
      };
    }

    const ticketCrm = await this.crmService.consultarEstadoTicket(
      incidente.externalIncidentId,
    );

    return {
      id: ticketCrm?.id ?? incidente.externalIncidentId,
      externalIncidentId: incidente.externalIncidentId,
      saludRef: ticketCrm?.salud_ref ?? incidente.id,
      titulo: ticketCrm?.asunto ?? incidente.titulo,
      descripcion: incidente.descripcion,
      estado: ticketCrm?.estado ?? incidente.estado,
      severidad: ticketCrm?.prioridad ?? incidente.severidad,
      canal: ticketCrm?.canal,
      clienteNombre: ticketCrm?.cliente_nombre,
      resolucion: ticketCrm?.resolucion,
      fechaVencimientoSla: ticketCrm?.fecha_vencimiento_sla,
      creadoEn: ticketCrm?.creado_en,
      actualizadoEn: ticketCrm?.actualizado_en,
      sincronizado: !!ticketCrm,
      mensaje: ticketCrm
        ? 'Estado obtenido desde CRM'
        : 'No se pudo obtener estado desde CRM; se muestra estado local',
    };
  }

  async getContextInfo(incidente: IncidenteSalud) {
    let visita: Visita | null = null;
    let profesional: ProfesionalSalud | null = null;
    let profesionalUsuario: Usuario | null = null;

    if (incidente.visitaId) {
      visita = await this.visitaRepository.findOne({ where: { id: incidente.visitaId } });
    }
    if (incidente.profesionalSaludId) {
      profesional = await this.profesionalRepository.findOne({ where: { id: incidente.profesionalSaludId } });
      if (profesional?.usuarioId) {
        profesionalUsuario = await this.usuarioRepository.findOne({ where: { id: profesional.usuarioId } });
      }
    }
    return { visita, profesional, profesionalUsuario };
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

    // Crear ticket en CRM de forma asíncrona para no bloquear el flujo principal.
    try {
      let paciente: any = null;
      if (saved.pacienteId) {
        paciente = await this.pacientesService.findOne(saved.pacienteId).catch(() => null);
      }
      const crmPayload = this.crmService.buildPayloadFromIncidente(saved, paciente);
      this.crmService
        .crearTicket(crmPayload)
        .then(async (crmResponse) => {
          const externalIncidentId = this.crmService.extractTicketId(crmResponse);
          if (!externalIncidentId) return;

          await this.repository.update(saved.id, { externalIncidentId });
          saved.externalIncidentId = externalIncidentId;
        })
        .catch((err) => {
          this.logger.error(`Error en promesa de CRM: ${err.message}`);
        });
    } catch (err: any) {
      this.logger.error(`Error preparando ticket CRM: ${err.message}`);
    }

    if (saved.severidad === 'ALTA' || saved.severidad === 'CRITICA') {
      this.incidentesService.enviarIncidente(saved).catch((err) => {
        this.logger.error(`Error en promesa de Incidentes: ${err.message}`);
      });
    }

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

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { NotificacionesService } from '../integrations/notificaciones/notificaciones.service';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { Paciente } from './entities/paciente.entity';
import { DireccionPaciente } from './entities/direccion-paciente.entity';
import { ContactoPaciente } from './entities/contacto-paciente.entity';
import { PlanCuidado } from './entities/plan-cuidado.entity';
import { Visita } from './entities/visita.entity';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente)
    private readonly pacientesRepository: Repository<Paciente>,
    @InjectRepository(DireccionPaciente)
    private readonly direccionesRepository: Repository<DireccionPaciente>,
    @InjectRepository(ContactoPaciente)
    private readonly contactosRepository: Repository<ContactoPaciente>,
    @InjectRepository(PlanCuidado)
    private readonly planesRepository: Repository<PlanCuidado>,
    @InjectRepository(Visita)
    private readonly visitasRepository: Repository<Visita>,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async findAll(): Promise<Paciente[]> {
    return this.pacientesRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Paciente> {
    const pac = await this.pacientesRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!pac) {
      throw new NotFoundException('Paciente no encontrado');
    }

    return pac;
  }

  async create(dto: CreatePacienteDto): Promise<Paciente> {
    const paciente = this.pacientesRepository.create(dto as any);

    let saved: Paciente | Paciente[];
    try {
      saved = await this.pacientesRepository.save(paciente);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`El RUT ${dto.rut} ya está registrado.`);
      }
      throw error;
    }
    const result = Array.isArray(saved) ? (saved[0] as Paciente) : (saved as Paciente);
    this.auditoriasService.registrar({
      entidad: 'pacientes',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Paciente ${result.nombres} ${result.apellidos} creado`,
    });

    await this.analyticsService.sendPacienteUpsertEvent(result);
    await this.notificacionesService.notificarPacienteCreado(result);

    return result;
  }

  async update(id: string, dto: UpdatePacienteDto): Promise<Paciente> {
    const paciente = await this.findOne(id);
    const oldValues = { nombres: paciente.nombres, apellidos: paciente.apellidos, rut: paciente.rut };
    Object.assign(paciente, dto);

    let saved: Paciente | Paciente[];
    try {
      saved = await this.pacientesRepository.save(paciente);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`El RUT ${dto.rut || paciente.rut} ya está registrado por otro paciente.`);
      }
      throw error;
    }
    const result = Array.isArray(saved) ? (saved[0] as Paciente) : (saved as Paciente);
    this.auditoriasService.registrar({
      entidad: 'pacientes',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Paciente ${result.nombres} ${result.apellidos} actualizado`,
      oldValues,
      newValues: { nombres: result.nombres, apellidos: result.apellidos, rut: result.rut },
    });

    await this.analyticsService.sendPacienteUpsertEvent(result);

    return result;
  }

  async remove(id: string): Promise<Paciente> {
    const paciente = await this.findOne(id);
    paciente.deletedAt = new Date();
    const saved = await this.pacientesRepository.save(paciente);
    const result = Array.isArray(saved) ? (saved[0] as Paciente) : (saved as Paciente);
    this.auditoriasService.registrar({
      entidad: 'pacientes',
      entidadId: result.id,
      accion: 'ELIMINAR',
      detalle: `Paciente ${result.nombres} ${result.apellidos} eliminado (soft delete)`,
    });
    return result;
  }

  /* Direcciones */
  async findDirecciones(pacienteId: string): Promise<DireccionPaciente[]> {
    return this.direccionesRepository.find({
      where: { pacienteId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async createDireccion(dto: CreateDireccionDto): Promise<DireccionPaciente> {
    const d = this.direccionesRepository.create(dto as any);
    const saved = await this.direccionesRepository.save(d);
    return Array.isArray(saved) ? (saved[0] as DireccionPaciente) : (saved as DireccionPaciente);
  }

  async updateDireccion(id: string, dto: UpdateDireccionDto): Promise<DireccionPaciente> {
    const dir = await this.direccionesRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!dir) throw new NotFoundException('Dirección no encontrada');
    Object.assign(dir, dto);
    const saved = await this.direccionesRepository.save(dir);
    return Array.isArray(saved) ? (saved[0] as DireccionPaciente) : (saved as DireccionPaciente);
  }

  async removeDireccion(id: string): Promise<DireccionPaciente> {
    const dir = await this.direccionesRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!dir) throw new NotFoundException('Dirección no encontrada');
    dir.deletedAt = new Date();
    const saved = await this.direccionesRepository.save(dir);
    return Array.isArray(saved) ? (saved[0] as DireccionPaciente) : (saved as DireccionPaciente);
  }

  /* Contactos */
  async findContactos(pacienteId: string): Promise<ContactoPaciente[]> {
    return this.contactosRepository.find({ where: { pacienteId, deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async createContacto(dto: CreateContactoDto): Promise<ContactoPaciente> {
    const c = this.contactosRepository.create(dto as any);
    const saved = await this.contactosRepository.save(c);
    return Array.isArray(saved) ? (saved[0] as ContactoPaciente) : (saved as ContactoPaciente);
  }

  async updateContacto(id: string, dto: UpdateContactoDto): Promise<ContactoPaciente> {
    const c = await this.contactosRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Contacto no encontrado');
    Object.assign(c, dto);
    const saved = await this.contactosRepository.save(c);
    return Array.isArray(saved) ? (saved[0] as ContactoPaciente) : (saved as ContactoPaciente);
  }

  async removeContacto(id: string): Promise<ContactoPaciente> {
    const c = await this.contactosRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!c) throw new NotFoundException('Contacto no encontrado');
    c.deletedAt = new Date();
    const saved = await this.contactosRepository.save(c);
    return Array.isArray(saved) ? (saved[0] as ContactoPaciente) : (saved as ContactoPaciente);
  }

  /* Planes */
  async findPlanes(pacienteId: string): Promise<PlanCuidado[]> {
    return this.planesRepository.find({ where: { pacienteId, deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanCuidado> {
    const p = this.planesRepository.create(dto as any);
    const saved = await this.planesRepository.save(p);
    return Array.isArray(saved) ? (saved[0] as PlanCuidado) : (saved as PlanCuidado);
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<PlanCuidado> {
    const p = await this.planesRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException('Plan no encontrado');
    Object.assign(p, dto);
    const saved = await this.planesRepository.save(p);
    return Array.isArray(saved) ? (saved[0] as PlanCuidado) : (saved as PlanCuidado);
  }

  async removePlan(id: string): Promise<PlanCuidado> {
    const p = await this.planesRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!p) throw new NotFoundException('Plan no encontrado');
    p.deletedAt = new Date();
    const saved = await this.planesRepository.save(p);
    return Array.isArray(saved) ? (saved[0] as PlanCuidado) : (saved as PlanCuidado);
  }

  /* Visitas */
  async findVisitas(pacienteId: string): Promise<Visita[]> {
    return this.visitasRepository.find({ where: { pacienteId, deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async createVisita(dto: CreateVisitaDto): Promise<Visita> {
    const v = this.visitasRepository.create(dto as any);
    const saved = await this.visitasRepository.save(v);
    return Array.isArray(saved) ? (saved[0] as Visita) : (saved as Visita);
  }

  async updateVisita(id: string, dto: UpdateVisitaDto): Promise<Visita> {
    const v = await this.visitasRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!v) throw new NotFoundException('Visita no encontrada');
    Object.assign(v, dto);
    const saved = await this.visitasRepository.save(v);
    return Array.isArray(saved) ? (saved[0] as Visita) : (saved as Visita);
  }

  async removeVisita(id: string): Promise<Visita> {
    const v = await this.visitasRepository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!v) throw new NotFoundException('Visita no encontrada');
    v.deletedAt = new Date();
    const saved = await this.visitasRepository.save(v);
    return Array.isArray(saved) ? (saved[0] as Visita) : (saved as Visita);
  }
}

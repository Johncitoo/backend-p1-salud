import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { CreateProfesionalDto } from './dto/create-profesional.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';
import { UpdateProfesionalDto } from './dto/update-profesional.dto';
import { Especialidad } from './entities/especialidad.entity';
import { ProfesionalEspecialidad } from './entities/profesional-especialidad.entity';
import { ProfesionalSalud } from './entities/profesional-salud.entity';
import { ProfesionalZona } from './entities/profesional-zona.entity';

@Injectable()
export class ProfesionalesService {
  constructor(
    @InjectRepository(ProfesionalSalud) private readonly profesionales: Repository<ProfesionalSalud>,
    @InjectRepository(Especialidad) private readonly especialidades: Repository<Especialidad>,
    @InjectRepository(ProfesionalZona) private readonly profesionalZonas: Repository<ProfesionalZona>,
    @InjectRepository(ProfesionalEspecialidad) private readonly profesionalEspecialidades: Repository<ProfesionalEspecialidad>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  findAll() {
    return this.profesionales.find({ where: { deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const profesional = await this.profesionales.findOne({ where: { id, deletedAt: IsNull() } });
    if (!profesional) throw new NotFoundException('Profesional no encontrado');
    return profesional;
  }

  async create(dto: CreateProfesionalDto) {
    const result = await this.profesionales.save(this.profesionales.create({ ...dto, activo: dto.activo ?? true }));
    this.auditoriasService.registrar({
      entidad: 'profesionales_salud',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Profesional ${result.profesion} creado (usuarioId: ${result.usuarioId})`,
    });
    return result;
  }

  async update(id: string, dto: UpdateProfesionalDto) {
    const profesional = await this.findOne(id);
    const oldValues = { profesion: profesional.profesion, activo: profesional.activo };
    Object.assign(profesional, dto);
    const result = await this.profesionales.save(profesional);
    this.auditoriasService.registrar({
      entidad: 'profesionales_salud',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Profesional ${result.profesion} actualizado`,
      oldValues,
      newValues: { profesion: result.profesion, activo: result.activo },
    });
    return result;
  }

  async remove(id: string) {
    const profesional = await this.findOne(id);
    profesional.deletedAt = new Date();
    const result = await this.profesionales.save(profesional);
    this.auditoriasService.registrar({
      entidad: 'profesionales_salud',
      entidadId: result.id,
      accion: 'ELIMINAR',
      detalle: `Profesional ${result.profesion} eliminado (soft delete)`,
    });
    return result;
  }

  findEspecialidades() {
    return this.especialidades.find({ where: { deletedAt: IsNull() }, order: { nombre: 'ASC' } });
  }

  async findEspecialidad(id: string) {
    const especialidad = await this.especialidades.findOne({ where: { id, deletedAt: IsNull() } });
    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');
    return especialidad;
  }

  async createEspecialidad(dto: CreateEspecialidadDto) {
    const result = await this.especialidades.save(this.especialidades.create(dto));
    this.auditoriasService.registrar({
      entidad: 'especialidades',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Especialidad ${result.nombre} creada`,
    });
    return result;
  }

  async updateEspecialidad(id: string, dto: UpdateEspecialidadDto) {
    const especialidad = await this.findEspecialidad(id);
    const oldValues = { nombre: especialidad.nombre };
    Object.assign(especialidad, dto);
    const result = await this.especialidades.save(especialidad);
    this.auditoriasService.registrar({
      entidad: 'especialidades',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Especialidad ${result.nombre} actualizada`,
      oldValues,
      newValues: { nombre: result.nombre },
    });
    return result;
  }

  async removeEspecialidad(id: string) {
    const especialidad = await this.findEspecialidad(id);
    especialidad.deletedAt = new Date();
    const result = await this.especialidades.save(especialidad);
    this.auditoriasService.registrar({
      entidad: 'especialidades',
      entidadId: result.id,
      accion: 'ELIMINAR',
      detalle: `Especialidad ${result.nombre} eliminada (soft delete)`,
    });
    return result;
  }

  async asignar(id: string, zonaId?: string, especialidadId?: string) {
    await this.findOne(id);
    if (!zonaId && !especialidadId) throw new BadRequestException('Debes enviar zonaId o especialidadId');

    const result: Record<string, unknown> = {};
    if (zonaId) {
      const existing = await this.profesionalZonas.findOne({ where: { profesionalSaludId: id, zonaId, deletedAt: IsNull() } });
      result.zona = existing ?? await this.profesionalZonas.save(this.profesionalZonas.create({ profesionalSaludId: id, zonaId }));
    }
    if (especialidadId) {
      const existing = await this.profesionalEspecialidades.findOne({ where: { profesionalSaludId: id, especialidadId, deletedAt: IsNull() } });
      result.especialidad = existing ?? await this.profesionalEspecialidades.save(this.profesionalEspecialidades.create({ profesionalSaludId: id, especialidadId }));
    }
    return result;
  }
}

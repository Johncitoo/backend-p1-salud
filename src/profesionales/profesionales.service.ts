import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { NotificacionesService } from '../integrations/notificaciones/notificaciones.service';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
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
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // Obtiene nombres/apellidos del usuario asociado para enriquecer el evento de profesional.
  // Si notificarCreacion=true, además envía la notificación de profesional creado al Grupo 6.
  private async emitirProfesionalUpsert(profesional: ProfesionalSalud, notificarCreacion = false): Promise<void> {
    const usuario = await this.usuarios.findOne({ where: { id: profesional.usuarioId } });
    if (!usuario) return;
    await this.analyticsService.sendProfesionalUpsertEvent(profesional, {
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
    });
    if (notificarCreacion) {
      await this.notificacionesService.notificarProfesionalCreado(usuario);
    }
  }

  findAll() {
    return this.profesionales.find({ where: { deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const profesional = await this.profesionales.findOne({ where: { id, deletedAt: IsNull() } });
    if (!profesional) throw new NotFoundException('Profesional no encontrado');
    return profesional;
  }

  findUsuariosDisponibles() {
    const subquery = this.profesionales
      .createQueryBuilder('profesional')
      .select('profesional.usuario_id')
      .where('profesional.deleted_at IS NULL');

    return this.usuarios
      .createQueryBuilder('usuario')
      .innerJoin(Rol, 'rol', 'rol.id = usuario.rol_id AND rol.deleted_at IS NULL')
      .select([
        'usuario.id AS "id"',
        'usuario.rut AS "rut"',
        'usuario.nombres AS "nombres"',
        'usuario.apellidos AS "apellidos"',
        'usuario.email AS "email"',
        'rol.nombre AS "rol"',
      ])
      .where('usuario.deleted_at IS NULL')
      .andWhere('usuario.activo = TRUE')
      .andWhere('rol.nombre IN (:...roles)', { roles: ['PROFESIONAL', 'TECNICO'] })
      .andWhere(`usuario.id NOT IN (${subquery.getQuery()})`)
      .orderBy('usuario.nombres', 'ASC')
      .addOrderBy('usuario.apellidos', 'ASC')
      .getRawMany();
  }

  async create(dto: CreateProfesionalDto) {
    await this.ensureUsuarioProfesionalDisponible(dto.usuarioId);

    const result = await this.profesionales.save(this.profesionales.create({
      usuarioId: dto.usuarioId,
      profesion: dto.profesion,
      numeroRegistro: dto.numeroRegistro ?? null,
      activo: dto.activo ?? true,
    }));

    for (const especialidadId of dto.especialidadIds ?? []) {
      await this.asignar(result.id, undefined, especialidadId);
    }

    for (const zonaId of dto.zonaIds ?? []) {
      await this.asignar(result.id, zonaId, undefined);
    }

    this.auditoriasService.registrar({
      entidad: 'profesionales_salud',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Profesional ${result.profesion} creado (usuarioId: ${result.usuarioId})`,
    });

    await this.emitirProfesionalUpsert(result, true);

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

    await this.emitirProfesionalUpsert(result);

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

    await this.analyticsService.sendEspecialidadUpsertEvent(result);

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

    await this.analyticsService.sendEspecialidadUpsertEvent(result);

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

  private async ensureUsuarioProfesionalDisponible(usuarioId: string) {
    const usuario = await this.usuarios
      .createQueryBuilder('usuario')
      .innerJoin(Rol, 'rol', 'rol.id = usuario.rol_id AND rol.deleted_at IS NULL')
      .select([
        'usuario.id AS "id"',
        'rol.nombre AS "rol"',
        'usuario.activo AS "activo"',
      ])
      .where('usuario.id = :usuarioId', { usuarioId })
      .andWhere('usuario.deleted_at IS NULL')
      .getRawOne<{ id: string; rol: string; activo: boolean }>();

    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.activo) throw new BadRequestException('El usuario seleccionado esta inactivo');
    if (!['PROFESIONAL', 'TECNICO'].includes(usuario.rol)) {
      throw new BadRequestException('El usuario seleccionado debe tener rol PROFESIONAL o TECNICO');
    }

    const existing = await this.profesionales.findOne({
      where: { usuarioId, deletedAt: IsNull() },
    });
    if (existing) throw new BadRequestException('El usuario seleccionado ya esta registrado como profesional');
  }
}

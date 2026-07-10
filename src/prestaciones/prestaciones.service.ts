import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { Visita } from '../pacientes/entities/visita.entity';
import {
  CreatePrestacionDto,
  UpdatePrestacionDto,
} from './dto/create-prestacion.dto';
import {
  CreateVisitaPrestacionDto,
  UpdateVisitaPrestacionDto,
} from './dto/create-visita-prestacion.dto';
import { Prestacion } from './entities/prestacion.entity';
import { VisitaPrestacion } from './entities/visita-prestacion.entity';

const ESTADOS_VISITA_PRESTACION = [
  'PROGRAMADA',
  'REALIZADA',
  'NO_REALIZADA',
  'CANCELADA',
];

@Injectable()
export class PrestacionesService {
  constructor(
    @InjectRepository(Prestacion)
    private readonly prestacionesRepo: Repository<Prestacion>,
    @InjectRepository(VisitaPrestacion)
    private readonly visitaPrestacionesRepo: Repository<VisitaPrestacion>,
    @InjectRepository(Visita)
    private readonly visitasRepo: Repository<Visita>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: { activa?: boolean; q?: string }) {
    const qb = this.prestacionesRepo
      .createQueryBuilder('prestacion')
      .where('prestacion.deleted_at IS NULL');

    if (filtros?.activa !== undefined)
      qb.andWhere('prestacion.activa = :activa', { activa: filtros.activa });
    if (filtros?.q) {
      qb.andWhere(
        '(prestacion.codigo ILIKE :q OR prestacion.nombre ILIKE :q)',
        { q: `%${filtros.q}%` },
      );
    }

    return qb.orderBy('prestacion.nombre', 'ASC').getMany();
  }

  async findOne(id: string) {
    const prestacion = await this.prestacionesRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!prestacion) throw new NotFoundException('Prestación no encontrada');
    return prestacion;
  }

  async create(dto: CreatePrestacionDto) {
    const prestacion = this.prestacionesRepo.create({
      codigo: dto.codigo.trim().toUpperCase(),
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion ?? null,
      duracionEstimadaMin: dto.duracionEstimadaMin ?? null,
      activa: dto.activa ?? true,
    });

    let saved: Prestacion;
    try {
      saved = await this.prestacionesRepo.save(prestacion);
    } catch (error) {
      this.handleUniquePrestacionError(error);
      throw error;
    }

    this.auditoriasService.registrar({
      entidad: 'prestaciones',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Prestación ${saved.codigo} creada`,
    });

    return saved;
  }

  async update(id: string, dto: UpdatePrestacionDto) {
    const prestacion = await this.findOne(id);
    const oldValues = {
      codigo: prestacion.codigo,
      nombre: prestacion.nombre,
      activa: prestacion.activa,
    };

    if (dto.codigo !== undefined)
      prestacion.codigo = dto.codigo.trim().toUpperCase();
    if (dto.nombre !== undefined) prestacion.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) prestacion.descripcion = dto.descripcion;
    if (dto.duracionEstimadaMin !== undefined)
      prestacion.duracionEstimadaMin = dto.duracionEstimadaMin;
    if (dto.activa !== undefined) prestacion.activa = dto.activa;

    let saved: Prestacion;
    try {
      saved = await this.prestacionesRepo.save(prestacion);
    } catch (error) {
      this.handleUniquePrestacionError(error);
      throw error;
    }

    this.auditoriasService.registrar({
      entidad: 'prestaciones',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Prestación ${saved.codigo} actualizada`,
      oldValues,
      newValues: {
        codigo: saved.codigo,
        nombre: saved.nombre,
        activa: saved.activa,
      },
    });

    return saved;
  }

  async remove(id: string) {
    const prestacion = await this.findOne(id);
    prestacion.deletedAt = new Date();
    const saved = await this.prestacionesRepo.save(prestacion);

    this.auditoriasService.registrar({
      entidad: 'prestaciones',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Prestación ${saved.codigo} eliminada`,
    });

    return saved;
  }

  async findByVisita(visitaId: string) {
    await this.ensureVisitaExists(visitaId);

    return this.visitaPrestacionesRepo
      .createQueryBuilder('vp')
      .leftJoinAndMapOne(
        'vp.prestacion',
        Prestacion,
        'prestacion',
        'prestacion.id = vp.prestacion_id',
      )
      .where('vp.visita_id = :visitaId', { visitaId })
      .andWhere('vp.deleted_at IS NULL')
      .orderBy('prestacion.nombre', 'ASC')
      .getMany();
  }

  async addToVisita(
    visitaId: string,
    dto: CreateVisitaPrestacionDto,
    usuarioId?: string,
  ) {
    const visita = await this.ensureEditableVisita(visitaId);
    const prestacion = await this.findOne(dto.prestacionId);

    if (!prestacion.activa)
      throw new BadRequestException(
        'No se puede asignar una prestación inactiva',
      );
    this.ensureEstadoValido(dto.estado ?? 'PROGRAMADA');

    const visitaPrestacion = this.visitaPrestacionesRepo.create({
      visitaId: visita.id,
      prestacionId: prestacion.id,
      cantidad: dto.cantidad ?? 1,
      estado: dto.estado ?? 'PROGRAMADA',
      observacion: dto.observacion ?? null,
    });

    let saved: VisitaPrestacion;
    try {
      saved = await this.visitaPrestacionesRepo.save(visitaPrestacion);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException(
          'La prestación ya está asignada a esta visita',
        );
      }
      throw error;
    }

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visita_prestaciones',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Prestación ${prestacion.codigo} asignada a visita ${visita.id}`,
    });

    return this.findVisitaPrestacion(visita.id, prestacion.id);
  }

  async updateVisitaPrestacion(
    visitaId: string,
    prestacionId: string,
    dto: UpdateVisitaPrestacionDto,
    usuarioId?: string,
  ) {
    await this.ensureEditableVisita(visitaId);
    const visitaPrestacion = await this.findVisitaPrestacion(
      visitaId,
      prestacionId,
    );

    if (dto.estado !== undefined) {
      this.ensureEstadoValido(dto.estado);
      visitaPrestacion.estado = dto.estado;
    }
    if (dto.cantidad !== undefined) visitaPrestacion.cantidad = dto.cantidad;
    if (dto.observacion !== undefined)
      visitaPrestacion.observacion = dto.observacion;

    const saved = await this.visitaPrestacionesRepo.save(visitaPrestacion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visita_prestaciones',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Prestación de visita ${visitaId} actualizada`,
    });

    return this.findVisitaPrestacion(visitaId, prestacionId);
  }

  async removeFromVisita(
    visitaId: string,
    prestacionId: string,
    usuarioId?: string,
  ) {
    await this.ensureEditableVisita(visitaId);
    const visitaPrestacion = await this.findVisitaPrestacion(
      visitaId,
      prestacionId,
    );
    visitaPrestacion.deletedAt = new Date();
    const saved = await this.visitaPrestacionesRepo.save(visitaPrestacion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'visita_prestaciones',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Prestación ${prestacionId} removida de visita ${visitaId}`,
    });

    return saved;
  }

  private async ensureVisitaExists(visitaId: string) {
    const visita = await this.visitasRepo.findOne({
      where: { id: visitaId, deletedAt: IsNull() },
    });
    if (!visita) throw new NotFoundException('Visita no encontrada');
    return visita;
  }

  private async ensureEditableVisita(visitaId: string) {
    const visita = await this.ensureVisitaExists(visitaId);
    if (['REALIZADA', 'CANCELADA'].includes(visita.estado)) {
      throw new BadRequestException(
        'No se pueden modificar prestaciones de una visita cerrada o cancelada',
      );
    }
    return visita;
  }

  private async findVisitaPrestacion(visitaId: string, prestacionId: string) {
    const visitaPrestacion = await this.visitaPrestacionesRepo
      .createQueryBuilder('vp')
      .leftJoinAndMapOne(
        'vp.prestacion',
        Prestacion,
        'prestacion',
        'prestacion.id = vp.prestacion_id',
      )
      .where('vp.visita_id = :visitaId', { visitaId })
      .andWhere('vp.prestacion_id = :prestacionId', { prestacionId })
      .andWhere('vp.deleted_at IS NULL')
      .getOne();

    if (!visitaPrestacion)
      throw new NotFoundException('Prestación de visita no encontrada');
    return visitaPrestacion;
  }

  private ensureEstadoValido(estado: string) {
    if (!ESTADOS_VISITA_PRESTACION.includes(estado)) {
      throw new BadRequestException('Estado de prestación de visita inválido');
    }
  }

  private handleUniquePrestacionError(error: unknown) {
    if (error instanceof QueryFailedError && (error as any).code === '23505') {
      const detail = (error as any).detail ?? '';
      if (detail.includes('codigo'))
        throw new ConflictException('Ya existe una prestación con ese código');
      if (detail.includes('nombre'))
        throw new ConflictException('Ya existe una prestación con ese nombre');
      throw new ConflictException('Ya existe una prestación con esos datos');
    }
  }
}

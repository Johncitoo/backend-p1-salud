import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateVariableClinicaDto, UpdateVariableClinicaDto } from './dto/create-variable-clinica.dto';
import { VariableClinica } from './entities/variable-clinica.entity';

@Injectable()
export class VariablesClinicasService {
  constructor(
    @InjectRepository(VariableClinica)
    private readonly repo: Repository<VariableClinica>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: { codigo?: string; nombre?: string; categoria?: string; activa?: boolean }) {
    const qb = this.repo.createQueryBuilder('vc').where('vc.deleted_at IS NULL');

    if (filtros?.codigo) qb.andWhere('vc.codigo ILIKE :codigo', { codigo: `%${filtros.codigo}%` });
    if (filtros?.nombre) qb.andWhere('vc.nombre ILIKE :nombre', { nombre: `%${filtros.nombre}%` });
    if (filtros?.categoria) qb.andWhere('vc.categoria = :categoria', { categoria: filtros.categoria });
    if (filtros?.activa !== undefined) qb.andWhere('vc.activa = :activa', { activa: filtros.activa });

    return qb.orderBy('vc.nombre', 'ASC').getMany();
  }

  async findOne(id: string) {
    const entity = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!entity) throw new NotFoundException('Variable clínica no encontrada');
    return entity;
  }

  async findByCodigo(codigo: string) {
    return this.repo.findOne({ where: { codigo, deletedAt: IsNull() } });
  }

  async create(dto: CreateVariableClinicaDto) {
    const existente = await this.repo.findOne({
      where: { codigo: dto.codigo, deletedAt: IsNull() },
    });
    if (existente) {
      throw new BadRequestException(`Ya existe una variable clinica con el codigo ${dto.codigo}`);
    }

    const entity = this.repo.create({
      codigo: dto.codigo,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      categoria: dto.categoria ?? null,
      tipoDato: dto.tipoDato,
      unidad: dto.unidad ?? null,
      valorMinimo: dto.valorMinimo ?? null,
      valorMaximo: dto.valorMaximo ?? null,
      sinonimos: dto.sinonimos ?? null,
      activa: dto.activa ?? true,
    });
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({ entidad: 'variables_clinicas', entidadId: saved.id, accion: 'CREAR', detalle: `Variable ${saved.codigo} creada` });
    return saved;
  }

  async update(id: string, dto: UpdateVariableClinicaDto) {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({ entidad: 'variables_clinicas', entidadId: saved.id, accion: 'ACTUALIZAR', detalle: `Variable ${saved.codigo} actualizada` });
    return saved;
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    entity.deletedAt = new Date();
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({ entidad: 'variables_clinicas', entidadId: saved.id, accion: 'ELIMINAR', detalle: `Variable ${saved.codigo} eliminada` });
    return saved;
  }
}

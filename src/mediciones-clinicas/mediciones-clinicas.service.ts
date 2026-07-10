import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import {
  CreateMedicionClinicaDto,
  UpdateMedicionClinicaDto,
} from './dto/create-medicion-clinica.dto';
import { MedicionClinica } from './entities/medicion-clinica.entity';

@Injectable()
export class MedicionesClinicasService {
  constructor(
    @InjectRepository(MedicionClinica)
    private readonly repo: Repository<MedicionClinica>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(filtros?: {
    pacienteId?: string;
    visitaId?: string;
    fichaClinicaId?: string;
    variableClinicaId?: string;
    codigoVariable?: string;
    origen?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }) {
    const qb = this.repo
      .createQueryBuilder('mc')
      .leftJoinAndSelect('mc.variableClinica', 'variableClinica')
      .where('mc.deleted_at IS NULL');

    if (filtros?.pacienteId)
      qb.andWhere('mc.paciente_id = :pacienteId', {
        pacienteId: filtros.pacienteId,
      });
    if (filtros?.visitaId)
      qb.andWhere('mc.visita_id = :visitaId', { visitaId: filtros.visitaId });
    if (filtros?.fichaClinicaId)
      qb.andWhere('mc.ficha_clinica_id = :fichaId', {
        fichaId: filtros.fichaClinicaId,
      });
    if (filtros?.origen)
      qb.andWhere('mc.origen = :origen', { origen: filtros.origen });

    // join opcional a variables_clinicas para filtrar por código
    if (filtros?.codigoVariable) {
      qb.innerJoin(
        'variables_clinicas',
        'vc',
        'vc.id = mc.variable_clinica_id AND vc.deleted_at IS NULL',
      ).andWhere('vc.codigo = :codigo', { codigo: filtros.codigoVariable });
    }
    if (filtros?.variableClinicaId) {
      qb.andWhere('mc.variable_clinica_id = :varId', {
        varId: filtros.variableClinicaId,
      });
    }
    if (filtros?.fechaDesde)
      qb.andWhere('mc.fecha_medicion >= :desde', { desde: filtros.fechaDesde });
    if (filtros?.fechaHasta)
      qb.andWhere('mc.fecha_medicion <= :hasta', { hasta: filtros.fechaHasta });

    return qb.orderBy('mc.fecha_medicion', 'DESC').getMany();
  }

  async findOne(id: string) {
    const entity = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!entity) throw new NotFoundException('Medición clínica no encontrada');
    return entity;
  }

  async create(dto: CreateMedicionClinicaDto, usuarioId?: string) {
    const entity = this.repo.create({
      ...dto,
      origen: dto.origen ?? 'MANUAL',
      registradoPorUsuarioId: usuarioId ?? null,
    });
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({
      entidad: 'mediciones_clinicas',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: 'Medición registrada',
    });
    return saved;
  }

  async update(id: string, dto: UpdateMedicionClinicaDto) {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({
      entidad: 'mediciones_clinicas',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: 'Medición actualizada',
    });
    return saved;
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    entity.deletedAt = new Date();
    const saved = await this.repo.save(entity);
    this.auditoriasService.registrar({
      entidad: 'mediciones_clinicas',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: 'Medición eliminada',
    });
    return saved;
  }

  async findByVisita(visitaId: string) {
    return this.findAll({ visitaId });
  }

  async findByPaciente(pacienteId: string) {
    return this.findAll({ pacienteId });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';
import { Auditoria } from './entities/auditoria.entity';

export interface RegistrarAuditoriaParams {
  usuarioId?: string;
  entidad: string;
  entidadId: string;
  accion: string;
  detalle?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

@Injectable()
export class AuditoriasService {
  constructor(@InjectRepository(Auditoria) private readonly auditorias: Repository<Auditoria>) {}

  findAll() {
    return this.auditorias.find({ order: { fechaHora: 'DESC' }, take: 200 });
  }

  async findOne(id: string) {
    const auditoria = await this.auditorias.findOne({ where: { id } });
    if (!auditoria) throw new NotFoundException('Auditoria no encontrada');
    return auditoria;
  }

  create(dto: CreateAuditoriaDto) {
    return this.auditorias.save(this.auditorias.create({ ...dto, origen: 'WEB' }));
  }

  /** Helper ligero para que otros servicios registren eventos sin armar el DTO completo */
  registrar(params: RegistrarAuditoriaParams) {
    const registro = this.auditorias.create({
      usuarioId: params.usuarioId ?? '00000000-0000-0000-0000-000000000000',
      entidad: params.entidad,
      entidadId: params.entidadId,
      accion: params.accion,
      detalle: params.detalle ?? null,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      origen: 'SISTEMA',
    });
    // fire-and-forget: no bloqueamos la respuesta por la auditoria
    this.auditorias.save(registro).catch(() => {});
  }
}

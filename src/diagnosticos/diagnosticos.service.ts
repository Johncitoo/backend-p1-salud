import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateDiagnosticoDto } from './dto/create-diagnostico.dto';
import { Diagnostico } from './entities/diagnostico.entity';

@Injectable()
export class DiagnosticosService {
  constructor(
    @InjectRepository(Diagnostico)
    private readonly repository: Repository<Diagnostico>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  // Una visita puede tener múltiples diagnósticos a lo largo de varias fichas
  // clínicas (a diferencia de FichaClinica, que solo admite una por visita).
  async findAll(filtros?: { visitaId?: string }): Promise<Diagnostico[]> {
    const qb = this.repository.createQueryBuilder('d').where('d.deleted_at IS NULL');

    if (filtros?.visitaId)
      qb.andWhere('d.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('d.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Diagnostico> {
    const diagnostico = await this.repository.findOne({ where: { id } });
    if (!diagnostico || diagnostico.deletedAt) {
      throw new NotFoundException('Diagnóstico no encontrado');
    }
    return diagnostico;
  }

  async create(dto: CreateDiagnosticoDto, usuarioId?: string): Promise<Diagnostico> {
    const diagnostico = this.repository.create({
      ...dto,
      creadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(diagnostico);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'diagnosticos',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Diagnóstico registrado para visita ${saved.visitaId}`,
    });

    return saved;
  }
}

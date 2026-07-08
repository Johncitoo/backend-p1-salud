import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { Medicamento } from './entities/medicamento.entity';
import { MedicamentoCatalogo } from './entities/medicamento-catalogo.entity';

@Injectable()
export class MedicamentosService {
  constructor(
    @InjectRepository(Medicamento)
    private readonly repository: Repository<Medicamento>,
    @InjectRepository(MedicamentoCatalogo)
    private readonly catalogoRepository: Repository<MedicamentoCatalogo>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  // Lista de medicamentos activos (no eliminados) para una visita. Una visita
  // puede tener múltiples fichas y múltiples medicamentos: no hay límite de 1,
  // a diferencia de FichaClinica.
  async findAll(filtros?: { visitaId?: string }): Promise<Medicamento[]> {
    const qb = this.repository.createQueryBuilder('m').where('m.deleted_at IS NULL');

    if (filtros?.visitaId)
      qb.andWhere('m.visita_id = :visitaId', { visitaId: filtros.visitaId });

    return qb.orderBy('m.created_at', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Medicamento> {
    const medicamento = await this.repository.findOne({ where: { id } });
    if (!medicamento || medicamento.deletedAt) {
      throw new NotFoundException('Medicamento no encontrado');
    }
    return medicamento;
  }

  // El nombre viaja denormalizado en el propio registro (además del FK al
  // catálogo) para que listar los medicamentos de una visita no dependa de un
  // join, y para que el nombre quede fijo históricamente aunque el catálogo
  // cambie después.
  async create(dto: CreateMedicamentoDto, usuarioId?: string): Promise<Medicamento> {
    const catalogo = await this.catalogoRepository.findOne({ where: { id: dto.medicamentoCatalogoId } });
    if (!catalogo) {
      throw new NotFoundException('Medicamento de catálogo no encontrado');
    }

    const medicamento = this.repository.create({
      visitaId: dto.visitaId,
      medicamentoCatalogoId: dto.medicamentoCatalogoId,
      cantidadCajas: dto.cantidadCajas,
      indicaciones: dto.indicaciones,
      nombre: catalogo.nombre,
      creadoPorUsuarioId: usuarioId,
    });

    const saved = await this.repository.save(medicamento);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'medicamentos',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Medicamento "${saved.nombre}" (${saved.cantidadCajas} caja(s)) agregado a visita ${saved.visitaId}`,
    });

    return saved;
  }

  async remove(id: string, usuarioId?: string): Promise<Medicamento> {
    const medicamento = await this.findOne(id);
    medicamento.deletedAt = new Date();
    const saved = await this.repository.save(medicamento);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'medicamentos',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: `Medicamento "${saved.nombre}" quitado de visita ${saved.visitaId}`,
    });

    return saved;
  }

  // Catálogo de medicamentos disponibles (solo lectura desde la app; se
  // administra vía seed/migración, no hay endpoint de escritura todavía).
  async findCatalogo(): Promise<MedicamentoCatalogo[]> {
    return this.catalogoRepository.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }
}

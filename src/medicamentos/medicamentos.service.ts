import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { CreateMedicamentoCatalogoDto } from './dto/create-medicamento-catalogo.dto';
import { UpdateMedicamentoCatalogoDto } from './dto/update-medicamento-catalogo.dto';
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

  // Catálogo de medicamentos disponibles para elegir al registrar un
  // medicamento en una visita. `incluirInactivos` es para la pantalla de
  // administración del catálogo, que también necesita ver (y reactivar) los
  // medicamentos desactivados.
  async findCatalogo(incluirInactivos = false): Promise<MedicamentoCatalogo[]> {
    return this.catalogoRepository.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async createCatalogo(dto: CreateMedicamentoCatalogoDto, usuarioId?: string): Promise<MedicamentoCatalogo> {
    const existente = await this.catalogoRepository.findOne({ where: { nombre: dto.nombre } });
    if (existente) {
      throw new ConflictException('Ya existe un medicamento en el catálogo con ese nombre');
    }

    const catalogo = this.catalogoRepository.create({
      nombre: dto.nombre,
      presentacion: dto.presentacion,
      activo: dto.activo ?? true,
    });
    const saved = await this.catalogoRepository.save(catalogo);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'medicamentos_catalogo',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Medicamento de catálogo "${saved.nombre}" creado`,
    });

    return saved;
  }

  async updateCatalogo(id: string, dto: UpdateMedicamentoCatalogoDto, usuarioId?: string): Promise<MedicamentoCatalogo> {
    const catalogo = await this.catalogoRepository.findOne({ where: { id } });
    if (!catalogo) throw new NotFoundException('Medicamento de catálogo no encontrado');

    if (dto.nombre && dto.nombre !== catalogo.nombre) {
      const existente = await this.catalogoRepository.findOne({ where: { nombre: dto.nombre } });
      if (existente) throw new ConflictException('Ya existe un medicamento en el catálogo con ese nombre');
    }

    Object.assign(catalogo, dto);
    catalogo.updatedAt = new Date();
    const saved = await this.catalogoRepository.save(catalogo);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'medicamentos_catalogo',
      entidadId: saved.id,
      accion: 'ACTUALIZAR',
      detalle: `Medicamento de catálogo "${saved.nombre}" actualizado`,
    });

    return saved;
  }
}

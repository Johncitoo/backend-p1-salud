import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';
import { Zona } from './entities/zona.entity';

@Injectable()
export class ZonasService {
  constructor(
    @InjectRepository(Zona)
    private readonly zonasRepository: Repository<Zona>,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async findAll(): Promise<Zona[]> {
    return this.zonasRepository.find({
      where: { deletedAt: IsNull() },
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Zona> {
    const zona = await this.zonasRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!zona) throw new NotFoundException('Zona no encontrada');

    return zona;
  }

  async create(dto: CreateZonaDto): Promise<Zona> {
    const zona = this.zonasRepository.create({
      ...dto,
      activa: dto.activa ?? true,
    });

    const saved = await this.zonasRepository.save(zona);
    const result = Array.isArray(saved) ? (saved[0] as Zona) : (saved as Zona);

    this.auditoriasService.registrar({
      entidad: 'zonas',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Zona ${result.nombre} (${result.comuna}, ${result.region}) creada`,
    });

    return result;
  }

  async update(id: string, dto: UpdateZonaDto): Promise<Zona> {
    const zona = await this.findOne(id);
    const oldValues = { nombre: zona.nombre, comuna: zona.comuna, region: zona.region, activa: zona.activa };
    Object.assign(zona, dto);

    const saved = await this.zonasRepository.save(zona);
    const result = Array.isArray(saved) ? (saved[0] as Zona) : (saved as Zona);

    this.auditoriasService.registrar({
      entidad: 'zonas',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Zona ${result.nombre} actualizada`,
      oldValues,
      newValues: { nombre: result.nombre, comuna: result.comuna, region: result.region, activa: result.activa },
    });

    return result;
  }

  async remove(id: string): Promise<Zona> {
    const zona = await this.findOne(id);
    zona.deletedAt = new Date();

    const saved = await this.zonasRepository.save(zona);
    const result = Array.isArray(saved) ? (saved[0] as Zona) : (saved as Zona);

    this.auditoriasService.registrar({
      entidad: 'zonas',
      entidadId: result.id,
      accion: 'ELIMINAR',
      detalle: `Zona ${result.nombre} eliminada (soft delete)`,
    });

    return result;
  }
}

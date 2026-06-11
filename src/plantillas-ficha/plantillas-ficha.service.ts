import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { VariablesClinicasService } from '../variables-clinicas/variables-clinicas.service';
import { CreatePlantillaFichaDto, UpdatePlantillaFichaDto } from './dto/create-plantilla-ficha.dto';
import { CreatePlantillaFichaCampoDto, UpdatePlantillaFichaCampoDto } from './dto/create-plantilla-ficha-campo.dto';
import { PlantillaFichaCampo } from './entities/plantilla-ficha-campo.entity';
import { PlantillaFicha } from './entities/plantilla-ficha.entity';

@Injectable()
export class PlantillasFichaService {
  constructor(
    @InjectRepository(PlantillaFicha)
    private readonly plantillasRepo: Repository<PlantillaFicha>,
    @InjectRepository(PlantillaFichaCampo)
    private readonly camposRepo: Repository<PlantillaFichaCampo>,
    private readonly variablesClinicasService: VariablesClinicasService,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  // ---- plantillas ----

  async findAll() {
    return this.plantillasRepo.find({ where: { deletedAt: IsNull() }, order: { nombre: 'ASC' } });
  }

  async findOne(id: string) {
    const plantilla = await this.plantillasRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');
    return plantilla;
  }

  async findOneWithCampos(id: string) {
    const plantilla = await this.findOne(id);
    const campos = await this.findCamposByPlantilla(id);
    return { ...plantilla, campos };
  }

  async create(dto: CreatePlantillaFichaDto) {
    const plantilla = this.plantillasRepo.create({
      codigo: dto.codigo,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      tipoAtencion: dto.tipoAtencion ?? null,
      activa: dto.activa ?? true,
      creadaPorUsuarioId: dto.creadaPorUsuarioId ?? null,
    });
    const saved = await this.plantillasRepo.save(plantilla);
    this.auditoriasService.registrar({ entidad: 'plantillas_ficha', entidadId: saved.id, accion: 'CREAR', detalle: `Plantilla ${saved.codigo} creada` });
    return saved;
  }

  async update(id: string, dto: UpdatePlantillaFichaDto) {
    const plantilla = await this.findOne(id);
    Object.assign(plantilla, dto);
    const saved = await this.plantillasRepo.save(plantilla);
    this.auditoriasService.registrar({ entidad: 'plantillas_ficha', entidadId: saved.id, accion: 'ACTUALIZAR', detalle: `Plantilla ${saved.codigo} actualizada` });
    return saved;
  }

  async remove(id: string) {
    const plantilla = await this.findOne(id);
    plantilla.deletedAt = new Date();
    const saved = await this.plantillasRepo.save(plantilla);
    this.auditoriasService.registrar({ entidad: 'plantillas_ficha', entidadId: saved.id, accion: 'ELIMINAR', detalle: `Plantilla ${saved.codigo} eliminada` });
    return saved;
  }

  // ---- campos ----

  async findCamposByPlantilla(plantillaFichaId: string) {
    return this.camposRepo.find({
      where: { plantillaFichaId, deletedAt: IsNull() },
      order: { orden: 'ASC' },
    });
  }

  async findCampo(id: string) {
    const campo = await this.camposRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!campo) throw new NotFoundException('Campo de plantilla no encontrado');
    return campo;
  }

  async createCampo(dto: CreatePlantillaFichaCampoDto & { plantillaFichaId: string }) {
    // validar que la plantilla existe
    await this.findOne(dto.plantillaFichaId);

    // validar variable_clinica si tipo VARIABLE_CLINICA
    if (dto.tipoCampo === 'VARIABLE_CLINICA') {
      if (!dto.variableClinicaId) throw new BadRequestException('variableClinicaId es obligatorio cuando tipoCampo = VARIABLE_CLINICA');
      await this.variablesClinicasService.findOne(dto.variableClinicaId);
    }

    // no duplicados en la misma plantilla
    const existente = await this.camposRepo.findOne({
      where: { plantillaFichaId: dto.plantillaFichaId, codigoCampo: dto.codigoCampo, deletedAt: IsNull() },
    });
    if (existente) throw new BadRequestException(`El campo ${dto.codigoCampo} ya existe en esta plantilla`);

    const campo = this.camposRepo.create({
      plantillaFichaId: dto.plantillaFichaId,
      variableClinicaId: dto.variableClinicaId ?? null,
      codigoCampo: dto.codigoCampo,
      etiqueta: dto.etiqueta,
      tipoCampo: dto.tipoCampo,
      obligatorio: dto.obligatorio ?? false,
      orden: dto.orden ?? 0,
      ayudaTexto: dto.ayudaTexto ?? null,
      opciones: dto.opciones ?? {},
      activo: dto.activo ?? true,
    });
    return this.camposRepo.save(campo);
  }

  async updateCampo(id: string, dto: UpdatePlantillaFichaCampoDto) {
    const campo = await this.findCampo(id);

    if (dto.tipoCampo) {
      const tipoEfectivo = dto.tipoCampo;
      const variableId = dto.variableClinicaId !== undefined ? dto.variableClinicaId : campo.variableClinicaId;
      if (tipoEfectivo === 'VARIABLE_CLINICA' && !variableId) {
        throw new BadRequestException('variableClinicaId es obligatorio cuando tipoCampo = VARIABLE_CLINICA');
      }
      if (variableId) await this.variablesClinicasService.findOne(variableId);
    }

    if (dto.codigoCampo && dto.codigoCampo !== campo.codigoCampo) {
      const existente = await this.camposRepo.findOne({
        where: { plantillaFichaId: campo.plantillaFichaId, codigoCampo: dto.codigoCampo, deletedAt: IsNull() },
      });
      if (existente) throw new BadRequestException(`El campo ${dto.codigoCampo} ya existe en esta plantilla`);
    }

    Object.assign(campo, dto);
    return this.camposRepo.save(campo);
  }

  async removeCampo(id: string) {
    const campo = await this.findCampo(id);
    campo.deletedAt = new Date();
    return this.camposRepo.save(campo);
  }

  /** Devuelve los campos de tipo VARIABLE_CLINICA activos de una plantilla */
  async findCamposVariablesByPlantilla(plantillaFichaId: string) {
    return this.camposRepo.find({
      where: { plantillaFichaId, tipoCampo: 'VARIABLE_CLINICA', deletedAt: IsNull() },
    });
  }
}

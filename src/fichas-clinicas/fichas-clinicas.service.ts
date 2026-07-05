import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { OptimisticLockVersionMismatchError } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { PlantillasFichaService } from '../plantillas-ficha/plantillas-ficha.service';
import { VariablesClinicasService } from '../variables-clinicas/variables-clinicas.service';
import { CreateFichaClinicaDto, UpdateFichaClinicaDto } from './dto/create-ficha-clinica.dto';
import { FichaClinica } from './entities/ficha-clinica.entity';
import { MedicionClinica } from '../mediciones-clinicas/entities/medicion-clinica.entity';

@Injectable()
export class FichasClinicasService {
  constructor(
    @InjectRepository(FichaClinica)
    private readonly fichasRepo: Repository<FichaClinica>,
    @InjectRepository(MedicionClinica)
    private readonly medicionesRepo: Repository<MedicionClinica>,
    private readonly plantillasService: PlantillasFichaService,
    private readonly variablesService: VariablesClinicasService,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Cuenta adjuntos activos de la ficha y emite el evento ficha_upsert a Analítica.
  // Usa query nativo sobre documentos_adjuntos para no acoplar al módulo de adjuntos.
  private async emitirFichaUpsert(ficha: FichaClinica): Promise<void> {
    const result = await this.fichasRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('documentos_adjuntos', 'da')
      .where('da.ficha_clinica_id = :fichaId', { fichaId: ficha.id })
      .andWhere('da.deleted_at IS NULL')
      .getRawOne<{ count: string }>();

    const adjuntosCount = Number(result?.count ?? 0);
    await this.analyticsService.sendFichaUpsertEvent(ficha, adjuntosCount);
  }

  async findAll(filtros?: { visitaId?: string; pacienteId?: string; estado?: string }) {
    const qb = this.fichasRepo.createQueryBuilder('fc').where('fc.deleted_at IS NULL');

    if (filtros?.visitaId) qb.andWhere('fc.visita_id = :visitaId', { visitaId: filtros.visitaId });
    if (filtros?.estado) qb.andWhere('fc.estado = :estado', { estado: filtros.estado });

    return qb.orderBy('fc.created_at', 'DESC').getMany();
  }

  async findOne(id: string) {
    const ficha = await this.fichasRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!ficha) throw new NotFoundException('Ficha clínica no encontrada');
    return ficha;
  }

  async create(dto: CreateFichaClinicaDto, usuarioId?: string) {
    if (dto.plantillaFichaId) {
      await this.plantillasService.findOne(dto.plantillaFichaId);
    }

    const ficha = this.fichasRepo.create({
      visitaId: dto.visitaId,
      plantillaFichaId: dto.plantillaFichaId ?? null,
      contenido: dto.contenido ?? {},
      estado: dto.estado ?? 'BORRADOR',
      creadaPorUsuarioId: usuarioId ?? null,
    });

    let saved: FichaClinica;
    try {
      saved = await this.fichasRepo.save(ficha);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        const detail = (error as any).detail ?? '';
        if (detail.includes('visita_id')) {
          throw new ConflictException('La visita seleccionada ya tiene una ficha clínica asociada.');
        }
      }
      throw error;
    }

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'fichas_clinicas',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: 'Ficha clínica creada',
      newValues: this.auditFichaValues(saved),
    });

    // Extraer mediciones si hay plantilla asociada
    if (dto.plantillaFichaId) {
      await this.syncMediciones(saved);
    }

    await this.emitirFichaUpsert(saved);

    return saved;
  }

  async update(id: string, dto: UpdateFichaClinicaDto, usuarioId?: string, expectedVersion?: number) {
    const ficha = await this.findOne(id);

    // Optimistic locking: verificar versión esperada
    if (expectedVersion !== undefined && ficha.version !== expectedVersion) {
      throw new ConflictException(
        `La ficha fue modificada por otro usuario. Recarga e intenta de nuevo. (Tu versión: ${expectedVersion}, actual: ${ficha.version})`,
      );
    }

    if (dto.plantillaFichaId) {
      await this.plantillasService.findOne(dto.plantillaFichaId);
    }

    const oldValues = this.auditFichaValues(ficha);
    const oldEstado = ficha.estado;

    if (dto.estado !== undefined) ficha.estado = dto.estado;
    if (dto.plantillaFichaId !== undefined) ficha.plantillaFichaId = dto.plantillaFichaId;
    if (dto.contenido !== undefined) ficha.contenido = dto.contenido;
    if (usuarioId) ficha.actualizadaPorUsuarioId = usuarioId;
    const shouldSyncMediciones = dto.contenido !== undefined || dto.plantillaFichaId !== undefined;
    const plantillaFichaIdForSync = ficha.plantillaFichaId ?? null;

    try {
      const saved = await this.fichasRepo.save(ficha);
      this.auditoriasService.registrar({
        usuarioId,
        entidad: 'fichas_clinicas',
        entidadId: saved.id,
        accion: 'ACTUALIZAR',
        detalle: `Ficha actualizada (${oldEstado} → ${saved.estado})`,
        oldValues,
        newValues: this.auditFichaValues(saved),
      });

      if (shouldSyncMediciones) {
        await this.syncMediciones({
          ...saved,
          plantillaFichaId: saved.plantillaFichaId ?? plantillaFichaIdForSync,
          contenido: saved.contenido ?? ficha.contenido,
        });
      }

      await this.emitirFichaUpsert(saved);

      return saved;
    } catch (error) {
      if (error instanceof OptimisticLockVersionMismatchError) {
        throw new ConflictException(
          'La ficha fue modificada por otro profesional mientras editabas. Recarga la página e intenta de nuevo.',
        );
      }
      throw error;
    }
  }

  async cerrar(id: string, usuarioId?: string) {
    const ficha = await this.findOne(id);
    if (ficha.estado === 'CERRADA') throw new BadRequestException('La ficha ya está cerrada');
    const oldValues = this.auditFichaValues(ficha);
    ficha.estado = 'CERRADA';
    if (usuarioId) ficha.actualizadaPorUsuarioId = usuarioId;
    const saved = await this.fichasRepo.save(ficha);
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'fichas_clinicas',
      entidadId: saved.id,
      accion: 'CERRAR',
      detalle: 'Ficha clínica cerrada',
      oldValues,
      newValues: this.auditFichaValues(saved),
    });

    await this.emitirFichaUpsert(saved);

    return saved;
  }

  async remove(id: string, usuarioId?: string) {
    const ficha = await this.findOne(id);
    const oldValues = this.auditFichaValues(ficha);
    ficha.deletedAt = new Date();
    const saved = await this.fichasRepo.save(ficha);
    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'fichas_clinicas',
      entidadId: saved.id,
      accion: 'ELIMINAR',
      detalle: 'Ficha clínica eliminada',
      oldValues,
      newValues: this.auditFichaValues(saved),
    });
    return saved;
  }

  // ============================================================
  // LÓGICA DE EXTRACCIÓN: contenido JSONB → mediciones_clinicas
  // ============================================================

  /**
   * Sincroniza mediciones_clinicas a partir del contenido de la ficha.
   * Estrategia MVP: soft-deletea mediciones anteriores de origen FICHA
   * asociadas a esta ficha y las recrea desde el contenido actual.
   */
  async syncMediciones(ficha: FichaClinica) {
    const plantillaId = ficha.plantillaFichaId;
    if (!plantillaId) return;

    // 1. Obtener campos de plantilla tipo VARIABLE_CLINICA
    const campos = await this.plantillasService.findCamposVariablesByPlantilla(plantillaId);
    if (campos.length === 0) return;

    // 2. Soft-delete mediciones anteriores de esta ficha con origen FICHA
    await this.medicionesRepo
      .createQueryBuilder()
      .update(MedicionClinica)
      .set({ deletedAt: new Date() })
      .where('ficha_clinica_id = :fichaId', { fichaId: ficha.id })
      .andWhere('origen = :origen', { origen: 'FICHA' })
      .andWhere('deleted_at IS NULL')
      .execute();

    // 3. Obtener pacienteId desde la visita (simplificado: lo obtenemos de la ficha + visita)
    // Como no tenemos relación directa en TypeORM, usamos el contenido o consultamos la visita
    const pacienteId = await this.obtenerPacienteIdDesdeVisita(ficha.visitaId);

    // 4. Por cada campo VARIABLE_CLINICA, extraer valor del contenido
    for (const campo of campos) {
      if (!campo.variableClinicaId) continue;

      const variable = await this.variablesService.findOne(campo.variableClinicaId);
      const valorRaw = ficha.contenido[campo.codigoCampo];

      // Si no hay valor en el contenido, saltar
      if (valorRaw === undefined || valorRaw === null || valorRaw === '') continue;

      // Validar rango si aplica
      if (variable.tipoDato === 'NUMERO' && typeof valorRaw === 'number') {
        if (variable.valorMinimo !== null && variable.valorMinimo !== undefined && valorRaw < variable.valorMinimo) {
          throw new BadRequestException(
            `${variable.nombre}: valor ${valorRaw} está por debajo del mínimo (${variable.valorMinimo} ${variable.unidad ?? ''})`,
          );
        }
        if (variable.valorMaximo !== null && variable.valorMaximo !== undefined && valorRaw > variable.valorMaximo) {
          throw new BadRequestException(
            `${variable.nombre}: valor ${valorRaw} está por encima del máximo (${variable.valorMaximo} ${variable.unidad ?? ''})`,
          );
        }
      }

      // Mapear valor según tipo_dato
      const medicion = this.medicionesRepo.create({
        fichaClinicaId: ficha.id,
        visitaId: ficha.visitaId,
        pacienteId: pacienteId,
        variableClinicaId: variable.id,
        unidad: variable.unidad ?? null,
        origen: 'FICHA',
        registradoPorUsuarioId: ficha.creadaPorUsuarioId ?? null,
        fechaMedicion: new Date(),
      });

      this.mapearValor(medicion, variable.tipoDato, valorRaw);
      await this.medicionesRepo.save(medicion);
    }
  }

  private mapearValor(medicion: MedicionClinica, tipoDato: string, valor: unknown) {
    switch (tipoDato) {
      case 'NUMERO':
        medicion.valorNumero = Number(valor);
        break;
      case 'TEXTO':
        medicion.valorTexto = String(valor);
        break;
      case 'BOOLEANO':
        medicion.valorBoolean = Boolean(valor);
        break;
      case 'FECHA':
        medicion.valorFecha = valor instanceof Date ? valor : new Date(String(valor));
        break;
      case 'JSON':
        medicion.valorJson = typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
        break;
      default:
        medicion.valorTexto = String(valor);
    }
  }

  private async obtenerPacienteIdDesdeVisita(visitaId: string): Promise<string> {
    // fallback: consultamos la tabla visitas directamente con query nativo
    const result = await this.fichasRepo.manager
      .createQueryBuilder()
      .select('paciente_id', 'pacienteId')
      .from('visitas', 'v')
      .where('v.id = :visitaId', { visitaId })
      .andWhere('v.deleted_at IS NULL')
      .getRawOne<{ pacienteId: string }>();

    if (!result?.pacienteId) throw new NotFoundException('No se pudo obtener el paciente desde la visita');
    return result.pacienteId;
  }

  private auditFichaValues(ficha: FichaClinica) {
    return {
      visitaId: ficha.visitaId,
      plantillaFichaId: ficha.plantillaFichaId ?? null,
      estado: ficha.estado,
      version: ficha.version,
      creadaPorUsuarioId: ficha.creadaPorUsuarioId ?? null,
      actualizadaPorUsuarioId: ficha.actualizadaPorUsuarioId ?? null,
      deletedAt: ficha.deletedAt ?? null,
    };
  }
}

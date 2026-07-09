import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { PedidosService } from '../integrations/pedidos/pedidos.service';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { CreateInspeccionMantenimientoDto } from './dto/create-inspeccion-mantenimiento.dto';
import { FinalizarIntervencionDto } from './dto/finalizar-intervencion.dto';
import { CorregirInformeDto } from './dto/corregir-informe.dto';
import { InspeccionMantenimiento, RepuestoSolicitado } from './entities/inspeccion-mantenimiento.entity';
import { REPUESTOS_CATALOGO, REPUESTOS_POR_SKU } from './repuestos.catalog';

@Injectable()
export class MantenimientoService {
  private readonly logger = new Logger(MantenimientoService.name);

  constructor(
    @InjectRepository(InspeccionMantenimiento)
    private readonly repository: Repository<InspeccionMantenimiento>,
    @InjectRepository(Paciente)
    private readonly pacientesRepository: Repository<Paciente>,
    @InjectRepository(DireccionPaciente)
    private readonly direccionesRepository: Repository<DireccionPaciente>,
    private readonly pedidosService: PedidosService,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  getCatalogoRepuestos() {
    return REPUESTOS_CATALOGO;
  }

  async findAll(filtros?: { pacienteId?: string; estado?: string }): Promise<InspeccionMantenimiento[]> {
    const qb = this.repository.createQueryBuilder('im').where('im.deleted_at IS NULL');
    if (filtros?.pacienteId) qb.andWhere('im.paciente_id = :pacienteId', { pacienteId: filtros.pacienteId });
    if (filtros?.estado) qb.andWhere('im.estado = :estado', { estado: filtros.estado });
    return qb.orderBy('im.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<InspeccionMantenimiento> {
    const inspeccion = await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    if (!inspeccion) throw new NotFoundException('Inspección de mantenimiento no encontrada');
    return inspeccion;
  }

  // Paso 9 (registra el informe) + Paso 10 (dispara el pedido de repuestos a P3).
  async create(dto: CreateInspeccionMantenimientoDto, usuarioId?: string): Promise<InspeccionMantenimiento> {
    const paciente = await this.pacientesRepository.findOne({
      where: { id: dto.pacienteId, deletedAt: IsNull() },
    });
    if (!paciente) throw new NotFoundException('Paciente no encontrado');

    // Validar repuestos contra el catálogo y enriquecer con el nombre canónico.
    const repuestos: RepuestoSolicitado[] = dto.repuestos.map((r) => {
      const catalogo = REPUESTOS_POR_SKU.get(r.sku);
      if (!catalogo) {
        throw new BadRequestException(`SKU de repuesto no reconocido: ${r.sku}`);
      }
      return { sku: catalogo.sku, nombre: catalogo.nombre, cantidad: r.cantidad };
    });

    const inspeccion = this.repository.create({
      pacienteId: dto.pacienteId,
      visitaId: dto.visitaId ?? null,
      equipo: dto.equipo,
      diagnostico: dto.diagnostico ?? null,
      prioridad: dto.prioridad ?? 'media',
      repuestos,
      estado: 'REGISTRADA',
      creadoPorUsuarioId: usuarioId,
    });

    let saved = await this.repository.save(inspeccion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'inspecciones_mantenimiento',
      entidadId: saved.id,
      accion: 'CREAR',
      detalle: `Inspección de mantenimiento del equipo "${saved.equipo}" con ${repuestos.length} repuesto(s)`,
    });

    // Paso 10: pedido automático de repuestos. Se persiste el resultado para que
    // Coordinación vea si Proyecto 3 lo aceptó o hubo que reintentar.
    saved = await this.enviarPedido(saved, paciente);

    return saved;
  }

  // Paso 19 del UAT: corrección del informe técnico. Guarda la versión actual en
  // el historial, incrementa el número de versión y actualiza el diagnóstico
  // (y el equipo, si se corrige). El pedido de repuestos NO se re-dispara: esto
  // solo corrige el documento, no vuelve a solicitar repuestos.
  async corregirInforme(
    id: string,
    dto: CorregirInformeDto,
    usuarioId?: string,
  ): Promise<InspeccionMantenimiento> {
    const inspeccion = await this.findOne(id);

    // Snapshot de la versión vigente antes de sobrescribirla.
    const historial = inspeccion.historialVersiones ?? [];
    historial.push({
      version: inspeccion.version,
      equipo: inspeccion.equipo,
      diagnostico: inspeccion.diagnostico ?? null,
      motivo: dto.motivo ?? null,
      corregidoPorUsuarioId: usuarioId ?? null,
      fecha: new Date().toISOString(),
    });

    inspeccion.historialVersiones = historial;
    inspeccion.version = inspeccion.version + 1;
    inspeccion.diagnostico = dto.diagnostico;
    if (dto.equipo) inspeccion.equipo = dto.equipo;

    const saved = await this.repository.save(inspeccion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'inspecciones_mantenimiento',
      entidadId: saved.id,
      accion: 'CORREGIR_INFORME',
      detalle: `Informe corregido a la versión ${saved.version}${dto.motivo ? `. Motivo: ${dto.motivo}` : ''}`,
    });

    return saved;
  }

  // Reintenta el envío del pedido a Proyecto 3 (útil si el primer intento falló
  // por caída de P3 o falta de stock puntual).
  async reintentarPedido(id: string): Promise<InspeccionMantenimiento> {
    const inspeccion = await this.findOne(id);
    return this.enviarPedido(inspeccion);
  }

  // Paso 14 (reemplazo de componentes): el técnico instaló los repuestos y registra
  // la intervención. La orden de trabajo queda FINALIZADA.
  async finalizarIntervencion(
    id: string,
    dto: FinalizarIntervencionDto,
    usuarioId?: string,
  ): Promise<InspeccionMantenimiento> {
    const inspeccion = await this.findOne(id);

    if (inspeccion.estado === 'FINALIZADA') {
      throw new BadRequestException('La intervención de esta inspección ya fue finalizada.');
    }

    inspeccion.estado = 'FINALIZADA';
    inspeccion.intervencionAt = new Date();
    inspeccion.intervencionNotas = dto.notas ?? null;
    const saved = await this.repository.save(inspeccion);

    this.auditoriasService.registrar({
      usuarioId,
      entidad: 'inspecciones_mantenimiento',
      entidadId: saved.id,
      accion: 'FINALIZAR_INTERVENCION',
      detalle: `Intervención finalizada (componentes instalados) para el equipo "${saved.equipo}"`,
    });

    return saved;
  }

  private async enviarPedido(
    inspeccion: InspeccionMantenimiento,
    pacienteConocido?: Paciente,
  ): Promise<InspeccionMantenimiento> {
    const paciente =
      pacienteConocido ??
      (await this.pacientesRepository.findOne({ where: { id: inspeccion.pacienteId } }));

    if (!paciente?.email) {
      inspeccion.estado = 'PEDIDO_RECHAZADO';
      inspeccion.pedidoError = 'El paciente no tiene email; Proyecto 3 lo requiere como identificador (CustomerID).';
      this.logger.warn(`Inspección ${inspeccion.id}: sin email de paciente, no se envía pedido a Proyecto 3.`);
      return this.repository.save(inspeccion);
    }

    const direccion = await this.obtenerDireccion(inspeccion.pacienteId);
    const payload = this.pedidosService.buildMantenimientoPayload(inspeccion, paciente, direccion);
    const resultado = await this.pedidosService.enviarPedidoMantenimiento(payload);

    if (resultado.ok) {
      inspeccion.estado = 'PEDIDO_ENVIADO';
      inspeccion.pedidoExternoId = resultado.pedidoId ?? null;
      inspeccion.pedidoEstadoExterno = resultado.mock
        ? `${resultado.estado ?? 'pendiente_preparacion'} (simulado)`
        : resultado.estado ?? null;
      inspeccion.pedidoError = null;
    } else {
      inspeccion.estado = 'PEDIDO_RECHAZADO';
      inspeccion.pedidoError = resultado.tipo ? `${resultado.error} (${resultado.tipo})` : resultado.error;
    }

    return this.repository.save(inspeccion);
  }

  private async obtenerDireccion(pacienteId: string): Promise<DireccionPaciente | null> {
    const principal = await this.direccionesRepository.findOne({
      where: { pacienteId, esPrincipal: true, deletedAt: IsNull() },
    });
    if (principal) return principal;
    return this.direccionesRepository.findOne({ where: { pacienteId, deletedAt: IsNull() } });
  }
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { PedidosService } from '../integrations/pedidos/pedidos.service';
import { IncidentesSaludService } from '../incidentes-salud/incidentes-salud.service';
import { DireccionPaciente } from '../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { InspeccionMantenimiento } from './entities/inspeccion-mantenimiento.entity';
import { MantenimientoService } from './mantenimiento.service';
import { REPUESTOS_CATALOGO } from './repuestos.catalog';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const paciente = {
  id: 'p-1', nombres: 'Ana', apellidos: 'Soto', email: 'ana@mail.cl', telefono: '+56911111111', deletedAt: null,
} as Paciente;

describe('MantenimientoService', () => {
  let service: MantenimientoService;
  let repository: MockRepository<InspeccionMantenimiento>;
  let pacientesRepository: MockRepository<Paciente>;
  let direccionesRepository: MockRepository<DireccionPaciente>;
  let visitasRepository: MockRepository<Visita>;
  let pedidosServiceMock: any;
  let auditoriasMock: any;
  let incidentesSaludMock: any;
  let httpServiceMock: any;
  let configServiceMock: any;

  const dtoBase = {
    pacienteId: 'p-1',
    equipo: 'Concentrador de oxígeno',
    diagnostico: 'Filtro desgastado y batería con baja capacidad',
    repuestos: [{ sku: 'FILTRO-HEPA-01', cantidad: 1 }, { sku: 'BATERIA-RESPALDO-02', cantidad: 1 }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    pacientesRepository = { findOne: jest.fn().mockResolvedValue(paciente) };
    direccionesRepository = { findOne: jest.fn().mockResolvedValue(null) };
    visitasRepository = { findOne: jest.fn().mockResolvedValue(null) };
    pedidosServiceMock = {
      buildMantenimientoPayload: jest.fn().mockReturnValue({ orderId: 'MANT-x' }),
      enviarPedidoMantenimiento: jest.fn().mockResolvedValue({
        ok: true, mock: false, pedidoId: 'ped-123', estado: 'pendiente_preparacion',
      }),
    };
    auditoriasMock = { registrar: jest.fn() };
    incidentesSaludMock = { create: jest.fn().mockResolvedValue({ id: 'inc-1' }) };
    httpServiceMock = {
      get: jest.fn().mockReturnValue(of({ data: { success: true, data: [] } })),
    };
    configServiceMock = {
      get: jest.fn().mockReturnValue('https://inventario.test'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MantenimientoService,
        { provide: getRepositoryToken(InspeccionMantenimiento), useValue: repository },
        { provide: getRepositoryToken(Paciente), useValue: pacientesRepository },
        { provide: getRepositoryToken(DireccionPaciente), useValue: direccionesRepository },
        { provide: getRepositoryToken(Visita), useValue: visitasRepository },
        { provide: PedidosService, useValue: pedidosServiceMock },
        { provide: AuditoriasService, useValue: auditoriasMock },
        { provide: IncidentesSaludService, useValue: incidentesSaludMock },
        { provide: HttpService, useValue: httpServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<MantenimientoService>(MantenimientoService);
  });

  it('getCatalogoRepuestos devuelve el catálogo fijo si Inventario no trae productos', async () => {
    await expect(service.getCatalogoRepuestos()).resolves.toEqual(REPUESTOS_CATALOGO);
  });

  it('getCatalogoRepuestos devuelve productos reales desde Inventario si existen', async () => {
    httpServiceMock.get.mockReturnValueOnce(of({
      data: {
        success: true,
        data: [
          { sku: 'MON-PRES-002', name: 'Monitor de Presión Arterial', stocks: [{ quantity: 150, reserved: 0 }] },
        ],
      },
    }));

    await expect(service.getCatalogoRepuestos()).resolves.toEqual([
      {
        sku: 'MON-PRES-002',
        nombre: 'Monitor de Presión Arterial',
        descripcion: 'Stock total: 150; reservado: 0',
      },
    ]);
  });

  it('create persiste la inspección, enriquece los repuestos y dispara el pedido a Proyecto 3', async () => {
    const result = await service.create(dtoBase as any, 'u-1');

    expect(repository.save).toHaveBeenCalled();
    expect(auditoriasMock.registrar).toHaveBeenCalled();
    // El SKU se enriquece con el nombre canónico del catálogo.
    expect(result.repuestos[0]).toEqual({ sku: 'FILTRO-HEPA-01', nombre: 'Filtro HEPA', cantidad: 1 });
    expect(pedidosServiceMock.enviarPedidoMantenimiento).toHaveBeenCalledTimes(1);
    // Respuesta 201 de P3 → estado y pedido_id persistidos.
    expect(result.estado).toBe('PEDIDO_ENVIADO');
    expect(result.pedidoExternoId).toBe('ped-123');
    expect(result.pedidoEstadoExterno).toBe('pendiente_preparacion');
  });

  it('create acepta SKUs reales del catálogo de Inventario', async () => {
    httpServiceMock.get.mockReturnValue(of({
      data: {
        success: true,
        data: [
          { sku: 'MON-PRES-002', name: 'Monitor de Presión Arterial', stocks: [{ quantity: 150, reserved: 0 }] },
        ],
      },
    }));

    const result = await service.create({
      pacienteId: 'p-1',
      equipo: 'Monitor de presión',
      diagnostico: 'Equipo requiere reemplazo',
      repuestos: [{ sku: 'MON-PRES-002', cantidad: 1 }],
    } as any, 'u-1');

    expect(result.repuestos[0]).toEqual({
      sku: 'MON-PRES-002',
      nombre: 'Monitor de Presión Arterial',
      cantidad: 1,
    });
    expect(pedidosServiceMock.enviarPedidoMantenimiento).toHaveBeenCalledTimes(1);
  });

  it('create con visitaId deriva paciente y dirección desde la visita', async () => {
    visitasRepository.findOne!.mockResolvedValue({
      id: 'v-1',
      pacienteId: 'p-1',
      direccionPacienteId: 'dir-1',
      deletedAt: null,
    } as Visita);
    direccionesRepository.findOne!.mockResolvedValue({
      id: 'dir-1',
      pacienteId: 'p-1',
      calle: 'Av. Vitacura',
      numero: '5950',
      comuna: 'Santiago',
      region: 'Metropolitana',
      deletedAt: null,
    } as DireccionPaciente);

    const result = await service.create({
      visitaId: 'v-1',
      equipo: 'Monitor de presión',
      diagnostico: 'Batería con baja capacidad',
      repuestos: [{ sku: 'FILTRO-HEPA-01', cantidad: 1 }],
    } as any, 'u-1');

    expect(result.pacienteId).toBe('p-1');
    expect(result.visitaId).toBe('v-1');
    expect(pedidosServiceMock.buildMantenimientoPayload).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'p-1', visitaId: 'v-1' }),
      paciente,
      expect.objectContaining({ id: 'dir-1', calle: 'Av. Vitacura' }),
    );
  });

  it('create genera un incidente MANUAL (origen WEB) para disparar CRM + Grupo 11 con los datos asociados', async () => {
    const result = await service.create(dtoBase as any, 'u-1');

    expect(incidentesSaludMock.create).toHaveBeenCalledTimes(1);
    const [dtoIncidente, usuarioId] = incidentesSaludMock.create.mock.calls[0];
    expect(dtoIncidente).toMatchObject({
      tipo: 'INSPECCION_MANTENIMIENTO',
      origen: 'WEB', // manual -> CRM + Grupo 11
      pacienteId: 'p-1',
      severidad: 'MEDIA',
    });
    expect(dtoIncidente.titulo).toContain('Concentrador de oxígeno');
    expect(dtoIncidente.metadata).toMatchObject({ equipo: 'Concentrador de oxígeno' });
    expect(usuarioId).toBe('u-1');
    // El id del incidente queda enlazado en la inspección.
    expect(result.incidenteId).toBe('inc-1');
  });

  it('create sigue registrando la inspección aunque falle la creación del incidente/ticket', async () => {
    incidentesSaludMock.create.mockRejectedValueOnce(new Error('CRM caído'));
    const result = await service.create(dtoBase as any, 'u-1');
    expect(result.estado).toBe('PEDIDO_ENVIADO'); // el flujo no se rompe
    expect(result.incidenteId).toBeUndefined();
  });

  it('create rechaza un SKU que no está en el catálogo (400) y NO llama a Proyecto 3', async () => {
    const dto = { ...dtoBase, repuestos: [{ sku: 'NO-EXISTE-99', cantidad: 1 }] };
    await expect(service.create(dto as any, 'u-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(pedidosServiceMock.enviarPedidoMantenimiento).not.toHaveBeenCalled();
  });

  it('create lanza NotFoundException si el paciente no existe', async () => {
    pacientesRepository.findOne!.mockResolvedValueOnce(null);
    await expect(service.create(dtoBase as any, 'u-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(pedidosServiceMock.enviarPedidoMantenimiento).not.toHaveBeenCalled();
  });

  it('create marca PEDIDO_RECHAZADO y NO envía si el paciente no tiene email', async () => {
    pacientesRepository.findOne!.mockResolvedValue({ ...paciente, email: null });
    const result = await service.create(dtoBase as any, 'u-1');
    expect(result.estado).toBe('PEDIDO_RECHAZADO');
    expect(result.pedidoError).toContain('email');
    expect(pedidosServiceMock.enviarPedidoMantenimiento).not.toHaveBeenCalled();
  });

  it('create en modo mock simula un pedido enviado (PEDIDO_ENVIADO + "simulado")', async () => {
    pedidosServiceMock.enviarPedidoMantenimiento.mockResolvedValue({
      ok: true, mock: true, pedidoId: 'MOCK-MANT-x', estado: 'pendiente_preparacion',
    });
    const result = await service.create(dtoBase as any, 'u-1');
    expect(result.estado).toBe('PEDIDO_ENVIADO');
    expect(result.pedidoExternoId).toBe('MOCK-MANT-x');
    expect(result.pedidoEstadoExterno).toContain('simulado');
  });

  it('create marca PEDIDO_RECHAZADO con el error cuando Proyecto 3 responde falla (ej. 409 sin stock)', async () => {
    pedidosServiceMock.enviarPedidoMantenimiento.mockResolvedValue({
      ok: false, error: 'Stock insuficiente para el SKU: FILTRO-HEPA-01', tipo: 'stock_insuficiente',
    });
    const result = await service.create(dtoBase as any, 'u-1');
    expect(result.estado).toBe('PEDIDO_RECHAZADO');
    expect(result.pedidoError).toContain('Stock insuficiente');
    expect(result.pedidoError).toContain('stock_insuficiente');
  });

  it('reintentarPedido reenvía el pedido de una inspección existente', async () => {
    repository.findOne!.mockResolvedValue({
      id: 'insp-1', pacienteId: 'p-1', equipo: 'Bomba', repuestos: [{ sku: 'FILTRO-HEPA-01', nombre: 'Filtro HEPA', cantidad: 1 }],
      estado: 'PEDIDO_RECHAZADO', deletedAt: null,
    });
    const result = await service.reintentarPedido('insp-1');
    expect(pedidosServiceMock.enviarPedidoMantenimiento).toHaveBeenCalledTimes(1);
    expect(result.estado).toBe('PEDIDO_ENVIADO');
  });

  it('finalizarIntervencion cierra la orden de trabajo (FINALIZADA + fecha + notas)', async () => {
    repository.findOne!.mockResolvedValue({
      id: 'insp-1', pacienteId: 'p-1', equipo: 'Concentrador', estado: 'PEDIDO_ENVIADO', deletedAt: null,
    });
    const result = await service.finalizarIntervencion('insp-1', { notas: 'Filtro y batería instalados' }, 'u-1');
    expect(result.estado).toBe('FINALIZADA');
    expect(result.intervencionAt).toBeInstanceOf(Date);
    expect(result.intervencionNotas).toBe('Filtro y batería instalados');
    expect(auditoriasMock.registrar).toHaveBeenCalled();
  });

  it('finalizarIntervencion rechaza si ya estaba FINALIZADA', async () => {
    repository.findOne!.mockResolvedValue({
      id: 'insp-1', pacienteId: 'p-1', equipo: 'Concentrador', estado: 'FINALIZADA', deletedAt: null,
    });
    await expect(service.finalizarIntervencion('insp-1', {}, 'u-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

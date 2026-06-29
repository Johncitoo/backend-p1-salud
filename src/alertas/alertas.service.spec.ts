import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { Alerta } from './entities/alerta.entity';
import { AlertasService } from './alertas.service';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<Alerta> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const alerta: Alerta = {
  id: 'a-1111',
  pacienteId: 'p-2222',
  visitaId: 'v-3333',
  tipo: 'PRESION_ALTA',
  mensaje: 'Presión sostenida sobre 160/100',
  prioridad: 'ALTA',
  estado: 'ABIERTA',
  createdAt: new Date('2026-06-28T10:00:00Z'),
  updatedAt: new Date('2026-06-28T10:00:00Z'),
  deletedAt: null,
};

describe('AlertasService', () => {
  let service: AlertasService;
  let repository: MockRepository<Alerta>;
  let auditoriasService: { registrar: jest.Mock };
  let analyticsService: { sendAlertaUpsertEvent: jest.Mock };

  beforeEach(async () => {
    repository = createRepositoryMock();
    auditoriasService = { registrar: jest.fn() };
    analyticsService = { sendAlertaUpsertEvent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertasService,
        { provide: getRepositoryToken(Alerta), useValue: repository },
        { provide: AuditoriasService, useValue: auditoriasService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    service = module.get<AlertasService>(AlertasService);
  });

  it('findOne retorna la alerta si existe', async () => {
    repository.findOne!.mockResolvedValue(alerta);

    await expect(service.findOne('a-1111')).resolves.toEqual(alerta);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'a-1111', deletedAt: IsNull() },
    });
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda la alerta con valores por defecto', async () => {
    const dto = {
      pacienteId: 'p-2222',
      visitaId: 'v-3333',
      tipo: 'PRESION_ALTA',
      mensaje: 'Presión alta detectada',
    };
    const created = { ...dto, prioridad: 'MEDIA', estado: 'ABIERTA' } as Alerta;
    const saved = { ...alerta, ...created };

    repository.create!.mockReturnValue(created);
    repository.save!.mockResolvedValue(saved);

    const result = await service.create(dto);

    expect(result).toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      prioridad: 'MEDIA',
      estado: 'ABIERTA',
    });
  });

  it('create envía alerta_upsert al Grupo 9', async () => {
    const dto = {
      pacienteId: 'p-2222',
      visitaId: 'v-3333',
      tipo: 'PRESION_ALTA',
      mensaje: 'Test',
    };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(alerta);

    await service.create(dto);

    expect(analyticsService.sendAlertaUpsertEvent).toHaveBeenCalledWith(alerta);
  });

  it('create registra auditoría', async () => {
    const dto = {
      pacienteId: 'p-2222',
      visitaId: 'v-3333',
      tipo: 'PRESION_ALTA',
      mensaje: 'Test',
    };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(alerta);

    await service.create(dto, 'user-123');

    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'user-123',
        entidad: 'alertas',
        accion: 'CREAR',
      }),
    );
  });

  it('update modifica la alerta y envía analytics', async () => {
    repository.findOne!.mockResolvedValue({ ...alerta });
    const updated = { ...alerta, estado: 'EN_REVISION' };
    repository.save!.mockResolvedValue(updated);

    const result = await service.update('a-1111', { estado: 'EN_REVISION' });

    expect(result.estado).toBe('EN_REVISION');
    expect(analyticsService.sendAlertaUpsertEvent).toHaveBeenCalledWith(updated);
    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ACTUALIZAR' }),
    );
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...alerta });
    repository.save!.mockImplementation(async (value) => value);

    const result = await service.remove('a-1111');

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ELIMINAR' }),
    );
  });
});

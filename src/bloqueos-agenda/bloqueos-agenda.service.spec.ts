import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { BloqueoAgenda } from './entities/bloqueo-agenda.entity';
import { BloqueosAgendaService } from './bloqueos-agenda.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const bloqueo: BloqueoAgenda = {
  id: 'b-1111', tipo: 'PROFESIONAL', profesionalSaludId: 'prof-2222', zonaId: null,
  fechaHoraInicio: new Date('2026-07-01T08:00:00Z'), fechaHoraFin: new Date('2026-07-01T14:00:00Z'),
  motivo: 'Vacaciones', observacion: null, estado: 'ACTIVO',
  creadoPorUsuarioId: 'u-1111', canceladoPorUsuarioId: null, canceladoAt: null,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as BloqueoAgenda;

describe('BloqueosAgendaService', () => {
  let service: BloqueosAgendaService;
  let repository: MockRepository<BloqueoAgenda>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloqueosAgendaService,
        { provide: getRepositoryToken(BloqueoAgenda), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<BloqueosAgendaService>(BloqueosAgendaService);
  });

  it('findOne retorna el bloqueo si existe', async () => {
    repository.findOne!.mockResolvedValue(bloqueo);
    await expect(service.findOne('b-1111')).resolves.toEqual(bloqueo);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con estado ACTIVO por defecto', async () => {
    const dto = { tipo: 'GENERAL' as const, fechaHoraInicio: '2026-07-01T08:00:00Z', fechaHoraFin: '2026-07-01T14:00:00Z', motivo: 'Test' };
    repository.create!.mockReturnValue({ ...dto, estado: 'ACTIVO' });
    repository.save!.mockResolvedValue(bloqueo);
    const result = await service.create(dto as any, 'u-1111');
    expect(result).toEqual(bloqueo);
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...bloqueo });
    repository.save!.mockImplementation(async (v) => v);
    const result = await service.remove('b-1111');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

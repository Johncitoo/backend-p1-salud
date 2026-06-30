import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { ReglaAsignacion } from './entities/regla-asignacion.entity';
import { ReglasAsignacionService } from './reglas-asignacion.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const regla: ReglaAsignacion = {
  id: 'r-1111', codigo: 'MISMA_ZONA', nombre: 'Priorizar misma zona',
  descripcion: 'Test', prioridad: 10, condiciones: {}, acciones: {}, activa: true,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as ReglaAsignacion;

describe('ReglasAsignacionService', () => {
  let service: ReglasAsignacionService;
  let repository: MockRepository<ReglaAsignacion>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReglasAsignacionService,
        { provide: getRepositoryToken(ReglaAsignacion), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<ReglasAsignacionService>(ReglasAsignacionService);
  });

  it('findOne retorna la regla si existe', async () => {
    repository.findOne!.mockResolvedValue(regla);
    await expect(service.findOne('r-1111')).resolves.toEqual(regla);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con valores por defecto', async () => {
    const dto = { codigo: 'TEST', nombre: 'Test' };
    repository.create!.mockReturnValue({ ...dto, prioridad: 100, activa: true });
    repository.save!.mockResolvedValue(regla);
    await expect(service.create(dto as any)).resolves.toEqual(regla);
  });

  it('create lanza ConflictException si codigo duplicado', async () => {
    repository.create!.mockReturnValue({});
    const error = new QueryFailedError('INSERT', [], new Error('dup'));
    (error as any).code = '23505';
    repository.save!.mockRejectedValue(error);
    await expect(service.create({ codigo: 'DUP', nombre: 'T' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...regla });
    repository.save!.mockImplementation(async (v) => v);
    const result = await service.remove('r-1111');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

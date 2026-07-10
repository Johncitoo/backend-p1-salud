import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { VisitaCheckpoint } from './entities/visita-checkpoint.entity';
import { VisitaCheckpointsService } from './visita-checkpoints.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const checkpoint: VisitaCheckpoint = {
  id: 'vc-1111',
  visitaId: 'v-2222',
  tipo: 'CHECK_IN',
  fechaHora: new Date(),
  latitud: -23.65,
  longitud: -70.39,
  precisionMetros: 10,
  origen: 'APP',
  observacion: null,
  registradoPorUsuarioId: 'u-1111',
  createdAt: new Date(),
};

describe('VisitaCheckpointsService', () => {
  let service: VisitaCheckpointsService;
  let repository: MockRepository<VisitaCheckpoint>;

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitaCheckpointsService,
        { provide: getRepositoryToken(VisitaCheckpoint), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<VisitaCheckpointsService>(VisitaCheckpointsService);
  });

  it('findOne retorna el checkpoint si existe', async () => {
    repository.findOne!.mockResolvedValue(checkpoint);
    await expect(service.findOne('vc-1111')).resolves.toEqual(checkpoint);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create guarda el checkpoint con origen APP por defecto', async () => {
    const dto = {
      visitaId: 'v-2222',
      tipo: 'CHECK_IN' as const,
      latitud: -23.65,
      longitud: -70.39,
    };
    repository.create!.mockReturnValue({ ...dto, origen: 'APP' });
    repository.save!.mockResolvedValue(checkpoint);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(
      checkpoint,
    );
  });
});

import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ReprogramacionVisita } from './entities/reprogramacion-visita.entity';
import { ReprogramacionesVisitaService } from './reprogramaciones-visita.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const reprog: ReprogramacionVisita = {
  id: 'rp-1111', visitaId: 'v-2222',
  fechaProgramadaAnterior: '2026-07-01' as any, horaProgramadaAnterior: '10:00:00' as any,
  fechaProgramadaNueva: '2026-07-02' as any, horaProgramadaNueva: '11:00:00' as any,
  motivoReprogramacionId: null, observacion: 'Cambio de agenda',
  reprogramadaPorUsuarioId: 'u-1111', createdAt: new Date(),
} as ReprogramacionVisita;

describe('ReprogramacionesVisitaService', () => {
  let service: ReprogramacionesVisitaService;
  let repository: MockRepository<ReprogramacionVisita>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReprogramacionesVisitaService,
        { provide: getRepositoryToken(ReprogramacionVisita), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<ReprogramacionesVisitaService>(ReprogramacionesVisitaService);
  });

  it('findOne retorna la reprogramación si existe', async () => {
    repository.findOne!.mockResolvedValue(reprog);
    await expect(service.findOne('rp-1111')).resolves.toEqual(reprog);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda la reprogramación', async () => {
    const dto = {
      visitaId: 'v-2222', fechaProgramadaAnterior: '2026-07-01', horaProgramadaAnterior: '10:00:00',
      fechaProgramadaNueva: '2026-07-02', horaProgramadaNueva: '11:00:00',
    };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(reprog);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(reprog);
  });
});

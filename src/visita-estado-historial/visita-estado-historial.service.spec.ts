import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { VisitaEstadoHistorial } from './entities/visita-estado-historial.entity';
import { VisitaEstadoHistorialService } from './visita-estado-historial.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const historial: VisitaEstadoHistorial = {
  id: 'vh-1111', visitaId: 'v-2222', estadoAnterior: 'PROGRAMADA', estadoNuevo: 'EN_ATENCION',
  motivo: null, observacion: null, cambiadoPorUsuarioId: 'u-1111', createdAt: new Date(),
} as VisitaEstadoHistorial;

describe('VisitaEstadoHistorialService', () => {
  let service: VisitaEstadoHistorialService;
  let repository: MockRepository<VisitaEstadoHistorial>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitaEstadoHistorialService,
        { provide: getRepositoryToken(VisitaEstadoHistorial), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<VisitaEstadoHistorialService>(VisitaEstadoHistorialService);
  });

  it('findOne retorna el registro si existe', async () => {
    repository.findOne!.mockResolvedValue(historial);
    await expect(service.findOne('vh-1111')).resolves.toEqual(historial);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda el registro de historial', async () => {
    const dto = { visitaId: 'v-2222', estadoNuevo: 'EN_ATENCION', estadoAnterior: 'PROGRAMADA' };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(historial);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(historial);
  });
});

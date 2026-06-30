import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { IncidenteEstadoHistorial } from './entities/incidente-estado-historial.entity';
import { IncidenteEstadoHistorialService } from './incidente-estado-historial.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const historial: IncidenteEstadoHistorial = {
  id: 'ieh-1111', incidenteSaludId: 'inc-2222', estadoAnterior: 'ABIERTO',
  estadoNuevo: 'EN_REVISION', motivo: 'Asignado a revisión', observacion: null,
  cambiadoPorUsuarioId: 'u-1111', createdAt: new Date(),
} as IncidenteEstadoHistorial;

describe('IncidenteEstadoHistorialService', () => {
  let service: IncidenteEstadoHistorialService;
  let repository: MockRepository<IncidenteEstadoHistorial>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidenteEstadoHistorialService,
        { provide: getRepositoryToken(IncidenteEstadoHistorial), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();
    service = module.get<IncidenteEstadoHistorialService>(IncidenteEstadoHistorialService);
  });

  it('findOne retorna el registro si existe', async () => {
    repository.findOne!.mockResolvedValue(historial);
    await expect(service.findOne('ieh-1111')).resolves.toEqual(historial);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda el registro de historial', async () => {
    const dto = { incidenteSaludId: 'inc-2222', estadoNuevo: 'EN_REVISION' };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(historial);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(historial);
  });
});

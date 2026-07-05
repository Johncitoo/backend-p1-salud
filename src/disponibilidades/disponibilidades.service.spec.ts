import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { DisponibilidadProfesional } from './entities/disponibilidad-profesional.entity';
import { DisponibilidadesService } from './disponibilidades.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<DisponibilidadProfesional> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const disponibilidad: DisponibilidadProfesional = {
  id: 'd-1111',
  profesionalSaludId: 'prof-2222',
  zonaId: 'z-3333',
  diaSemana: 1,
  horaInicio: '08:00:00',
  horaFin: '14:00:00',
  capacidadMaxVisitas: 6,
  vigenteDesde: null,
  vigenteHasta: null,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('DisponibilidadesService', () => {
  let service: DisponibilidadesService;
  let repository: MockRepository<DisponibilidadProfesional>;
  let auditoriasService: { registrar: jest.Mock };

  beforeEach(async () => {
    repository = createRepositoryMock();
    auditoriasService = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisponibilidadesService,
        { provide: getRepositoryToken(DisponibilidadProfesional), useValue: repository },
        { provide: AuditoriasService, useValue: auditoriasService },
      ],
    }).compile();

    service = module.get<DisponibilidadesService>(DisponibilidadesService);
  });

  it('findOne retorna la disponibilidad si existe', async () => {
    repository.findOne!.mockResolvedValue(disponibilidad);
    await expect(service.findOne('d-1111')).resolves.toEqual(disponibilidad);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con activo=true por defecto', async () => {
    const dto = {
      profesionalSaludId: 'prof-2222',
      diaSemana: 1,
      horaInicio: '08:00:00',
      horaFin: '14:00:00',
    };
    repository.create!.mockReturnValue({ ...dto, activo: true });
    repository.save!.mockResolvedValue(disponibilidad);

    const result = await service.create(dto);
    expect(result).toEqual(disponibilidad);
    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'CREAR' }),
    );
  });

  it('update modifica la disponibilidad', async () => {
    repository.findOne!.mockResolvedValue({ ...disponibilidad });
    const updated = { ...disponibilidad, capacidadMaxVisitas: 8 };
    repository.save!.mockResolvedValue(updated);

    const result = await service.update('d-1111', { capacidadMaxVisitas: 8 });
    expect(result.capacidadMaxVisitas).toBe(8);
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...disponibilidad });
    repository.save!.mockImplementation(async (value) => value);

    const result = await service.remove('d-1111');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

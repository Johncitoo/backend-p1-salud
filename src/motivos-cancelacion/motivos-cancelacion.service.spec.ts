import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { MotivoCancelacion } from './entities/motivo-cancelacion.entity';
import { MotivosCancelacionService } from './motivos-cancelacion.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<MotivoCancelacion> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const motivo: MotivoCancelacion = {
  id: 'mc-1111',
  codigo: 'PACIENTE_NO_DISPONIBLE',
  nombre: 'Paciente no disponible',
  descripcion: 'El paciente no estaba disponible',
  aplicaA: 'VISITA',
  requiereObservacion: true,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MotivosCancelacionService', () => {
  let service: MotivosCancelacionService;
  let repository: MockRepository<MotivoCancelacion>;
  let auditoriasService: { registrar: jest.Mock };

  beforeEach(async () => {
    repository = createRepositoryMock();
    auditoriasService = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotivosCancelacionService,
        { provide: getRepositoryToken(MotivoCancelacion), useValue: repository },
        { provide: AuditoriasService, useValue: auditoriasService },
      ],
    }).compile();

    service = module.get<MotivosCancelacionService>(MotivosCancelacionService);
  });

  it('findOne retorna el motivo si existe', async () => {
    repository.findOne!.mockResolvedValue(motivo);

    await expect(service.findOne('mc-1111')).resolves.toEqual(motivo);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'mc-1111', deletedAt: IsNull() },
    });
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con valores por defecto', async () => {
    const dto = { codigo: 'NUEVO', nombre: 'Motivo nuevo' };
    const created = { ...dto, aplicaA: 'VISITA', requiereObservacion: false, activo: true } as MotivoCancelacion;
    const saved = { ...motivo, ...created };

    repository.create!.mockReturnValue(created);
    repository.save!.mockResolvedValue(saved);

    const result = await service.create(dto);

    expect(result).toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      aplicaA: 'VISITA',
      requiereObservacion: false,
      activo: true,
    });
  });

  it('create lanza ConflictException si el código ya existe', async () => {
    const dto = { codigo: 'DUPLICADO', nombre: 'Test' };
    repository.create!.mockReturnValue(dto);

    const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
    (error as any).code = '23505';
    repository.save!.mockRejectedValue(error);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('create registra auditoría', async () => {
    const dto = { codigo: 'TEST', nombre: 'Test' };
    repository.create!.mockReturnValue(dto);
    repository.save!.mockResolvedValue(motivo);

    await service.create(dto);

    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'motivos_cancelacion',
        accion: 'CREAR',
      }),
    );
  });

  it('update modifica el motivo', async () => {
    repository.findOne!.mockResolvedValue({ ...motivo });
    const updated = { ...motivo, nombre: 'Nombre actualizado' };
    repository.save!.mockResolvedValue(updated);

    const result = await service.update('mc-1111', { nombre: 'Nombre actualizado' });

    expect(result.nombre).toBe('Nombre actualizado');
    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ACTUALIZAR' }),
    );
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...motivo });
    repository.save!.mockImplementation(async (value) => value);

    const result = await service.remove('mc-1111');

    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

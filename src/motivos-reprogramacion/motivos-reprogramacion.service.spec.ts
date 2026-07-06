import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { MotivoReprogramacion } from './entities/motivo-reprogramacion.entity';
import { MotivosReprogramacionService } from './motivos-reprogramacion.service';
import { AuditoriasService } from '../auditorias/auditorias.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<MotivoReprogramacion> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const motivo: MotivoReprogramacion = {
  id: 'mr-1111',
  codigo: 'AJUSTE_AGENDA',
  nombre: 'Ajuste de agenda',
  descripcion: 'Cambio por reorganización',
  requiereObservacion: true,
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('MotivosReprogramacionService', () => {
  let service: MotivosReprogramacionService;
  let repository: MockRepository<MotivoReprogramacion>;
  let auditoriasService: { registrar: jest.Mock };

  beforeEach(async () => {
    repository = createRepositoryMock();
    auditoriasService = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotivosReprogramacionService,
        { provide: getRepositoryToken(MotivoReprogramacion), useValue: repository },
        { provide: AuditoriasService, useValue: auditoriasService },
      ],
    }).compile();

    service = module.get<MotivosReprogramacionService>(MotivosReprogramacionService);
  });

  it('findAll retorna motivos no eliminados ordenados por nombre', async () => {
    repository.find!.mockResolvedValue([motivo]);

    await expect(service.findAll()).resolves.toEqual([motivo]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull() },
      order: { nombre: 'ASC' },
    });
  });

  it('findOne retorna el motivo si existe', async () => {
    repository.findOne!.mockResolvedValue(motivo);

    await expect(service.findOne('mr-1111')).resolves.toEqual(motivo);
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(service.findOne('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con valores por defecto', async () => {
    const dto = { codigo: 'NUEVO', nombre: 'Motivo nuevo' };
    const created = { ...dto, requiereObservacion: false, activo: true } as MotivoReprogramacion;
    const saved = { ...motivo, ...created };

    repository.create!.mockReturnValue(created);
    repository.save!.mockResolvedValue(saved);

    const result = await service.create(dto);

    expect(result).toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
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
        entidad: 'motivos_reprogramacion',
        accion: 'CREAR',
      }),
    );
  });

  it('update modifica el motivo', async () => {
    repository.findOne!.mockResolvedValue({ ...motivo });
    const updated = { ...motivo, nombre: 'Actualizado' };
    repository.save!.mockResolvedValue(updated);

    const result = await service.update('mr-1111', { nombre: 'Actualizado' });

    expect(result.nombre).toBe('Actualizado');
    expect(auditoriasService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ACTUALIZAR' }),
    );
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...motivo });
    repository.save!.mockImplementation(async (value) => value);

    const result = await service.remove('mr-1111');

    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

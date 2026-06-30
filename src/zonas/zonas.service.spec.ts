import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { Zona } from './entities/zona.entity';
import { ZonasService } from './zonas.service';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = (): MockRepository<Zona> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const zona: Zona = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Zona Norte',
  descripcion: 'Sector norte de cobertura',
  comuna: 'Antofagasta',
  region: 'Antofagasta',
  activa: true,
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  deletedAt: null,
};

describe('ZonasService', () => {
  let service: ZonasService;
  let repository: MockRepository<Zona>;
  let auditoriasService: { registrar: jest.Mock };

  beforeEach(async () => {
    repository = createRepositoryMock();
    auditoriasService = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZonasService,
        {
          provide: getRepositoryToken(Zona),
          useValue: repository,
        },
        {
          provide: AuditoriasService,
          useValue: auditoriasService,
        },
        {
          provide: AnalyticsService,
          useValue: { sendZonaUpsertEvent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ZonasService>(ZonasService);
  });

  it('lista zonas no eliminadas ordenadas por nombre', async () => {
    repository.find!.mockResolvedValue([zona]);

    await expect(service.findAll()).resolves.toEqual([zona]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { deletedAt: IsNull() },
      order: { nombre: 'ASC' },
    });
  });

  it('crea zonas activas por defecto', async () => {
    const dto = {
      nombre: 'Zona Centro',
      comuna: 'Antofagasta',
      region: 'Antofagasta',
    };
    const created = { ...dto, activa: true } as Zona;
    const saved = { ...zona, ...created };

    repository.create!.mockReturnValue(created);
    repository.save!.mockResolvedValue(saved);

    await expect(service.create(dto)).resolves.toEqual(saved);
    expect(repository.create).toHaveBeenCalledWith({ ...dto, activa: true });
  });

  it('actualiza una zona existente', async () => {
    const updated = { ...zona, nombre: 'Zona Norte Actualizada', activa: false };

    repository.findOne!.mockResolvedValue({ ...zona });
    repository.save!.mockResolvedValue(updated);

    await expect(service.update(zona.id, { nombre: updated.nombre, activa: false })).resolves.toEqual(updated);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ nombre: updated.nombre, activa: false }));
  });

  it('marca deletedAt al eliminar', async () => {
    repository.findOne!.mockResolvedValue({ ...zona });
    repository.save!.mockImplementation(async value => value);

    const removed = await service.remove(zona.id);

    expect(removed.deletedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: zona.id, deletedAt: expect.any(Date) }));
  });

  it('lanza NotFoundException si la zona no existe', async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(service.findOne(zona.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

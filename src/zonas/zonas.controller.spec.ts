import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

const zona = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Zona Norte',
  descripcion: null,
  comuna: 'Antofagasta',
  region: 'Antofagasta',
  activa: true,
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
  deletedAt: null,
};

describe('ZonasController', () => {
  let controller: ZonasController;
  let service: jest.Mocked<
    Pick<ZonasService, 'findAll' | 'findOne' | 'create' | 'update' | 'remove'>
  >;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZonasController],
      providers: [
        DevAuthGuard,
        RolesGuard,
        { provide: ZonasService, useValue: service },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'AUTH_MODE' ? 'mock' : undefined,
            ),
          },
        },
        {
          provide: UsuariosService,
          useValue: { findProfileByIdentityUserId: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ZonasController>(ZonasController);
  });

  it('delega findAll al servicio', async () => {
    service.findAll.mockResolvedValue([zona]);

    await expect(controller.findAll()).resolves.toEqual([zona]);
  });

  it('delega create al servicio', async () => {
    const dto: CreateZonaDto = {
      nombre: 'Zona Centro',
      comuna: 'Antofagasta',
      region: 'Antofagasta',
    };
    service.create.mockResolvedValue({ ...zona, ...dto });

    await expect(controller.create(dto)).resolves.toEqual({ ...zona, ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delega update al servicio', async () => {
    service.update.mockResolvedValue({ ...zona, activa: false });

    await expect(
      controller.update(zona.id, { activa: false }),
    ).resolves.toEqual({ ...zona, activa: false });
    expect(service.update).toHaveBeenCalledWith(zona.id, { activa: false });
  });

  it('delega remove al servicio', async () => {
    service.remove.mockResolvedValue({
      ...zona,
      deletedAt: new Date('2026-06-05T10:00:00Z'),
    });

    await expect(controller.remove(zona.id)).resolves.toEqual(
      expect.objectContaining({ id: zona.id }),
    );
    expect(service.remove).toHaveBeenCalledWith(zona.id);
  });
});

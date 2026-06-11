import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { DevAuthGuard } from './../src/auth/guards/dev-auth.guard';
import { RolesGuard } from './../src/auth/guards/roles.guard';
import { UsuariosService } from './../src/usuarios/usuarios.service';
import { Zona } from './../src/zonas/entities/zona.entity';
import { ZonasController } from './../src/zonas/zonas.controller';
import { ZonasService } from './../src/zonas/zonas.service';

describe('HTTP routes (e2e)', () => {
  let app: INestApplication<App>;
  let zones: Zona[];

  beforeEach(async () => {
    zones = [];

    const zonasService = {
      findAll: jest.fn(async () => zones.filter(zone => !zone.deletedAt)),
      findOne: jest.fn(async (id: string) => {
        const zone = zones.find(currentZone => currentZone.id === id && !currentZone.deletedAt);
        if (!zone) throw new NotFoundException('Zona no encontrada');
        return zone;
      }),
      create: jest.fn(async (dto: Partial<Zona>) => {
        const now = new Date();
        const zone = {
          id: randomUUID(),
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          comuna: dto.comuna,
          region: dto.region,
          activa: dto.activa ?? true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        } as Zona;
        zones.push(zone);
        return zone;
      }),
      update: jest.fn(async (id: string, dto: Partial<Zona>) => {
        const zone = zones.find(currentZone => currentZone.id === id && !currentZone.deletedAt);
        if (!zone) throw new NotFoundException('Zona no encontrada');
        Object.assign(zone, dto, { updatedAt: new Date() });
        return zone;
      }),
      remove: jest.fn(async (id: string) => {
        const zone = zones.find(currentZone => currentZone.id === id && !currentZone.deletedAt);
        if (!zone) throw new NotFoundException('Zona no encontrada');
        zone.deletedAt = new Date();
        return zone;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, ZonasController],
      providers: [
        AppService,
        DevAuthGuard,
        RolesGuard,
        {
          provide: ZonasService,
          useValue: zonasService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'AUTH_MODE' ? 'mock' : undefined)),
          },
        },
        {
          provide: UsuariosService,
          useValue: {
            findProfileByIdentityUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/zonas CRUD', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/zonas')
      .set('x-mock-role', 'COORDINADOR')
      .send({
        nombre: 'Zona Test',
        descripcion: 'Cobertura de prueba',
        comuna: 'Antofagasta',
        region: 'Antofagasta',
      })
      .expect(201);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        nombre: 'Zona Test',
        descripcion: 'Cobertura de prueba',
        comuna: 'Antofagasta',
        region: 'Antofagasta',
        activa: true,
      }),
    );

    const id = createResponse.body.id as string;

    await request(app.getHttpServer())
      .get('/zonas')
      .set('x-mock-role', 'COORDINADOR')
      .expect(200)
      .expect(response => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ id, nombre: 'Zona Test' })]),
        );
      });

    await request(app.getHttpServer())
      .patch(`/zonas/${id}`)
      .set('x-mock-role', 'COORDINADOR')
      .send({ nombre: 'Zona Test Actualizada', activa: false })
      .expect(200)
      .expect(response => {
        expect(response.body).toEqual(
          expect.objectContaining({ id, nombre: 'Zona Test Actualizada', activa: false }),
        );
      });

    await request(app.getHttpServer())
      .delete(`/zonas/${id}`)
      .set('x-mock-role', 'SUPERVISOR')
      .expect(200)
      .expect(response => {
        expect(response.body).toEqual(expect.objectContaining({ id, deletedAt: expect.any(String) }));
      });

    await request(app.getHttpServer()).get(`/zonas/${id}`).set('x-mock-role', 'COORDINADOR').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});

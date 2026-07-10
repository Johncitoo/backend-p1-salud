import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PacientesController } from '../src/pacientes/pacientes.controller';
import { PacientesService } from '../src/pacientes/pacientes.service';

describe('PacientesController (unit)', () => {
  let app: INestApplication;
  let service: Partial<Record<keyof PacientesService, jest.Mock>>;

  beforeAll(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: '1', nombres: 'X' }),
      create: jest.fn().mockResolvedValue({ id: '1', nombres: 'X' }),
      update: jest.fn().mockResolvedValue({ id: '1', nombres: 'Y' }),
      remove: jest.fn().mockResolvedValue({ id: '1', deletedAt: new Date() }),
      findDirecciones: jest.fn().mockResolvedValue([]),
      createDireccion: jest.fn().mockResolvedValue({ id: 'd1' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PacientesController],
      providers: [{ provide: PacientesService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /pacientes returns array', async () => {
    await request(app.getHttpServer()).get('/pacientes').expect(200).expect([]);
  });

  it('GET /pacientes/:id returns paciente', async () => {
    await request(app.getHttpServer())
      .get('/pacientes/1')
      .expect(200)
      .expect({ id: '1', nombres: 'X' });
  });

  it('POST /pacientes delegates to service', async () => {
    await request(app.getHttpServer())
      .post('/pacientes')
      .send({ rut: '11.111.111-1', nombres: 'X', apellidos: 'Y' })
      .expect(201)
      .expect({ id: '1', nombres: 'X' });
  });
});

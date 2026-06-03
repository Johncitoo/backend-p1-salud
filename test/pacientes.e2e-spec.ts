import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacientesModule } from '../src/pacientes/pacientes.module';
import { Paciente } from '../src/pacientes/entities/paciente.entity';
import { DireccionPaciente } from '../src/pacientes/entities/direccion-paciente.entity';
import { ContactoPaciente } from '../src/pacientes/entities/contacto-paciente.entity';
import { PlanCuidado } from '../src/pacientes/entities/plan-cuidado.entity';
import { Visita } from '../src/pacientes/entities/visita.entity';

describe('Pacientes (e2e)', () => {
  let app: INestApplication;

  jest.setTimeout(20000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Paciente, DireccionPaciente, ContactoPaciente, PlanCuidado, Visita],
          synchronize: true,
        }),
        PacientesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST/GET paciente flow and validation', async () => {
    // invalid payload -> 400
    await request(app.getHttpServer()).post('/pacientes').send({}).expect(400);

    // create
    const createRes = await request(app.getHttpServer())
      .post('/pacientes')
      .send({ nombres: 'Test', apellidos: 'User' })
      .expect(201);

    const id = createRes.body.id;
    expect(id).toBeDefined();

    // get list
    const list = await request(app.getHttpServer()).get('/pacientes').expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    // create direccion
    await request(app.getHttpServer())
      .post(`/pacientes/${id}/direcciones`)
      .send({ calle: 'Calle 1' })
      .expect(201);

    // create contacto
    await request(app.getHttpServer())
      .post(`/pacientes/${id}/contactos`)
      .send({ nombre: 'Contacto 1' })
      .expect(201);

    // create plan
    await request(app.getHttpServer())
      .post(`/pacientes/${id}/planes`)
      .send({ objetivo: 'Cuidado' })
      .expect(201);

    // create visita
    await request(app.getHttpServer())
      .post(`/pacientes/${id}/visitas`)
      .send({ observacion: 'OK' })
      .expect(201);
  }, 20000);
});

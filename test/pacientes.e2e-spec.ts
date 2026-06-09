import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PacientesModule } from '../src/pacientes/pacientes.module';
import { Rol } from '../src/usuarios/entities/rol.entity';
import { Usuario } from '../src/usuarios/entities/usuario.entity';
import { Paciente } from '../src/pacientes/entities/paciente.entity';
import { DireccionPaciente } from '../src/pacientes/entities/direccion-paciente.entity';
import { ContactoPaciente } from '../src/pacientes/entities/contacto-paciente.entity';
import { PlanCuidado } from '../src/pacientes/entities/plan-cuidado.entity';
import { Visita } from '../src/pacientes/entities/visita.entity';

describe('Pacientes (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  jest.setTimeout(20000);

  beforeAll(async () => {
    process.env.AUTH_MODE = 'mock';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST ?? 'localhost',
          port: Number(process.env.TEST_DB_PORT ?? 5433),
          username: process.env.TEST_DB_USER ?? 'admin',
          password: process.env.TEST_DB_PASSWORD ?? 'admin123',
          database: process.env.TEST_DB_NAME ?? 'salud_db',
          entities: [Paciente, DireccionPaciente, ContactoPaciente, PlanCuidado, Visita, Usuario, Rol],
          synchronize: false,
        }),
        PacientesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);
    await dataSource.query(`DELETE FROM pacientes WHERE rut = $1`, ['99.999.999-9']);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM pacientes WHERE rut = $1`, ['99.999.999-9']);
    }
    await app?.close();
  });

  it('POST/GET paciente flow and validation', async () => {
    // invalid payload -> 400
    await request(app.getHttpServer()).post('/pacientes').set('x-mock-role', 'COORDINADOR').send({}).expect(400);

    // create
    const createRes = await request(app.getHttpServer())
      .post('/pacientes')
      .set('x-mock-role', 'COORDINADOR')
      .send({
        rut: '99.999.999-9',
        nombres: 'Test',
        apellidos: 'User',
        fechaNacimiento: '1980-01-20',
        sexo: 'FEMENINO',
        telefono: '+56911111111',
        email: 'paciente.test@correo.cl',
        direccion: 'Calle Principal 123',
      })
      .expect(201);

    const id = createRes.body.id;
    expect(id).toBeDefined();
    expect(createRes.body.rut).toBe('99.999.999-9');
    expect(createRes.body.direccion).toBe('Calle Principal 123');

    // get list
    const list = await request(app.getHttpServer()).get('/pacientes').set('x-mock-role', 'PROFESIONAL').expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((patient: Paciente) => patient.id === id)).toBe(true);
  }, 20000);
});

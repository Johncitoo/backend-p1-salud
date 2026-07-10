import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Rol } from '../src/usuarios/entities/rol.entity';
import { Usuario } from '../src/usuarios/entities/usuario.entity';
import { UsuariosModule } from '../src/usuarios/usuarios.module';
import { Auditoria } from '../src/auditorias/entities/auditoria.entity';

describe('Usuarios (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let rolId: string;

  const rut = '77.777.777-7';
  const email = 'usuario.local@correo.cl';
  const identityUserId = 'local-test-identity-user-id';

  jest.setTimeout(20000);

  beforeAll(async () => {
    process.env.AUTH_MODE = 'mock';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const databaseUrl =
              configService.get<string>('DATABASE_URL') ||
              'postgres://admin:admin123@localhost:5432/salud_db';
            return {
              type: 'postgres',
              url: databaseUrl,
              entities: [Usuario, Rol, Auditoria],
              synchronize: false,
              ssl: databaseUrl.includes('railway')
                ? { rejectUnauthorized: false }
                : undefined,
            };
          },
        }),
        UsuariosModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query(
      `DELETE FROM usuarios WHERE rut = $1 OR email = $2 OR identity_user_id = $3`,
      [rut, email, identityUserId],
    );

    const roles = await dataSource.query(
      `SELECT id FROM roles WHERE nombre = 'ADMIN' AND deleted_at IS NULL LIMIT 1`,
    );
    rolId = roles[0].id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM usuarios WHERE rut = $1 OR email = $2 OR identity_user_id = $3`,
        [rut, email, identityUserId],
      );
    }
    await app?.close();
  });

  it('creates, lists, updates and soft deletes a local usuario', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('x-mock-role', 'ADMIN')
      .send({})
      .expect(400);

    const createRes = await request(app.getHttpServer())
      .post('/usuarios')
      .set('x-mock-role', 'ADMIN')
      .send({
        identityUserId,
        rolId,
        rut,
        nombres: 'Usuario',
        apellidos: 'Local',
        email,
        telefono: '+56977777777',
        activo: true,
      })
      .expect(201);

    const id = createRes.body.id;
    expect(id).toBeDefined();
    expect(createRes.body.rol).toBe('ADMIN');
    expect(createRes.body.email).toBe(email);

    const listRes = await request(app.getHttpServer())
      .get('/usuarios')
      .set('x-mock-role', 'ADMIN')
      .expect(200);
    expect(listRes.body.some((usuario: Usuario) => usuario.id === id)).toBe(
      true,
    );

    const updateRes = await request(app.getHttpServer())
      .patch(`/usuarios/${id}`)
      .set('x-mock-role', 'ADMIN')
      .send({ nombres: 'Usuario Editado', activo: false })
      .expect(200);

    expect(updateRes.body.nombres).toBe('Usuario Editado');
    expect(updateRes.body.activo).toBe(false);

    await request(app.getHttpServer())
      .delete(`/usuarios/${id}`)
      .set('x-mock-role', 'ADMIN')
      .expect(200);

    const afterDeleteList = await request(app.getHttpServer())
      .get('/usuarios')
      .set('x-mock-role', 'ADMIN')
      .expect(200);
    expect(
      afterDeleteList.body.some((usuario: Usuario) => usuario.id === id),
    ).toBe(false);
  });
});

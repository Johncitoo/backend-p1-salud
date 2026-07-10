import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { DocumentosAdjuntosController } from '../src/documentos-adjuntos/documentos-adjuntos.controller';
import { DocumentosAdjuntosService } from '../src/documentos-adjuntos/documentos-adjuntos.service';
import { DevAuthGuard } from '../src/auth/guards/dev-auth.guard';
import { type AppRole } from '../src/auth/decorators/roles.decorator';

describe('DocumentosAdjuntosController (e2e)', () => {
  let app: INestApplication<App>;
  const documentoId = randomUUID();
  const fichaClinicaId = randomUUID();

  const service = {
    upload: jest.fn(async () => ({
      id: documentoId,
      fichaClinicaId,
      nombreArchivo: 'test.pdf',
      categoria: 'GENERAL',
    })),
    findAll: jest.fn(async () => []),
    download: jest.fn(async () => ({
      buffer: Buffer.from('archivo-descifrado'),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    })),
    remove: jest.fn(async () => ({ id: documentoId, estado: 'ELIMINADO' })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosAdjuntosController],
      providers: [{ provide: DocumentosAdjuntosService, useValue: service }],
    })
      .overrideGuard(DevAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          const role = (
            request.header('x-mock-role') ?? 'ADMIN'
          ).toUpperCase() as AppRole;
          request.user = {
            id: randomUUID(),
            identityUserId: `mock-${role.toLowerCase()}`,
            nombres: 'Usuario',
            apellidos: role,
            email: `${role.toLowerCase()}@mock.local`,
            rol: role,
            activo: true,
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('uploads a multipart document', async () => {
    await request(app.getHttpServer())
      .post('/documentos-adjuntos')
      .set('x-mock-role', 'ADMIN')
      .field('fichaClinicaId', fichaClinicaId)
      .field('categoria', 'GENERAL')
      .attach('file', Buffer.from('%PDF-1.4\n'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({ id: documentoId, fichaClinicaId }),
        );
      });

    expect(service.upload).toHaveBeenCalledWith(
      expect.objectContaining({ fichaClinicaId, categoria: 'GENERAL' }),
      expect.objectContaining({ originalname: 'test.pdf' }),
      expect.any(String),
    );
  });

  it('streams a decrypted document download', async () => {
    await request(app.getHttpServer())
      .get(`/documentos-adjuntos/${documentoId}/download`)
      .set('x-mock-role', 'SUPERVISOR')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /test\.pdf/);

    expect(service.download).toHaveBeenCalledWith(
      documentoId,
      expect.any(String),
      expect.any(Object),
    );
  });

  it('blocks supervisor uploads', async () => {
    await request(app.getHttpServer())
      .post('/documentos-adjuntos')
      .set('x-mock-role', 'SUPERVISOR')
      .field('fichaClinicaId', fichaClinicaId)
      .field('categoria', 'GENERAL')
      .attach('file', Buffer.from('%PDF-1.4\n'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);

    expect(service.upload).not.toHaveBeenCalled();
  });

  it('blocks professional deletes', async () => {
    await request(app.getHttpServer())
      .delete(`/documentos-adjuntos/${documentoId}`)
      .set('x-mock-role', 'PROFESIONAL')
      .expect(403);

    expect(service.remove).not.toHaveBeenCalled();
  });
});

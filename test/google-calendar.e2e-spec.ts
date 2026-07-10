import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { DevAuthGuard } from '../src/auth/guards/dev-auth.guard';
import { type AppRole } from '../src/auth/decorators/roles.decorator';
import { GoogleCalendarController } from '../src/google-calendar/google-calendar.controller';
import { GoogleCalendarService } from '../src/google-calendar/google-calendar.service';
import { VisitasController } from '../src/visitas/visitas.controller';
import { VisitasService } from '../src/visitas/visitas.service';

const professionalUserId = randomUUID();

const makeAuthGuard = () => ({
  canActivate: (context) => {
    const req = context.switchToHttp().getRequest();
    const role = (
      req.header('x-mock-role') ?? 'PROFESIONAL'
    ).toUpperCase() as AppRole;
    req.user = {
      id: role === 'PROFESIONAL' ? professionalUserId : randomUUID(),
      identityUserId: `mock-${role.toLowerCase()}`,
      nombres: 'Usuario',
      apellidos: role,
      email: `${role.toLowerCase()}@mock.local`,
      rol: role,
      activo: true,
    };
    return true;
  },
});

describe('Google Calendar and calendar routes (e2e)', () => {
  let app: INestApplication<App>;

  const googleCalendarService = {
    getConnectUrl: jest.fn(async () => ({
      authorizationUrl:
        'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    })),
    handleCallback: jest.fn(async () => ({
      connected: true,
      profesionalSaludId: randomUUID(),
      syncEnabled: true,
    })),
    getStatus: jest.fn(async () => ({
      connected: true,
      profesionalSaludId: randomUUID(),
      syncEnabled: true,
    })),
    disconnect: jest.fn(async () => ({
      connected: false,
      profesionalSaludId: randomUUID(),
      syncEnabled: false,
    })),
  };

  const visitasService = {
    findAllForUser: jest.fn(async () => []),
    findCalendarForUser: jest.fn(async () => []),
    findGoogleCalendarLogs: jest.fn(async () => []),
    retryPendingGoogleCalendarSync: jest.fn(async () => ({
      attempted: 1,
      synced: 1,
      failed: 0,
    })),
    findOne: jest.fn(),
    create: jest.fn(async (dto: Record<string, unknown>) => ({
      id: randomUUID(),
      ...dto,
      estado: 'PROGRAMADA',
    })),
    update: jest.fn(async (id: string, dto: Record<string, unknown>) => ({
      id,
      ...dto,
    })),
    resyncGoogleCalendar: jest.fn(async (id: string) => ({
      id,
      googleCalendarSyncStatus: 'SYNCED',
    })),
    cambiarEstado: jest.fn(
      async (id: string, dto: Record<string, unknown>) => ({ id, ...dto }),
    ),
    completar: jest.fn(async (id: string, dto: Record<string, unknown>) => ({
      id,
      estado: 'REALIZADA',
      ...dto,
    })),
    cancelar: jest.fn(async (id: string, dto: Record<string, unknown>) => ({
      id,
      estado: 'CANCELADA',
      ...dto,
    })),
    remove: jest.fn(async (id: string) => ({
      id,
      deletedAt: new Date().toISOString(),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GoogleCalendarController, VisitasController],
      providers: [
        { provide: GoogleCalendarService, useValue: googleCalendarService },
        { provide: VisitasService, useValue: visitasService },
      ],
    })
      .overrideGuard(DevAuthGuard)
      .useValue(makeAuthGuard())
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

  it('allows a professional to start Google Calendar OAuth', async () => {
    await request(app.getHttpServer())
      .get('/google-calendar/connect')
      .set('x-mock-role', 'PROFESIONAL')
      .expect(200)
      .expect((response) => {
        expect(response.body.authorizationUrl).toContain('accounts.google.com');
      });

    expect(googleCalendarService.getConnectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ rol: 'PROFESIONAL' }),
    );
  });

  it('blocks coordinators from connecting Google Calendar', async () => {
    await request(app.getHttpServer())
      .get('/google-calendar/connect')
      .set('x-mock-role', 'COORDINADOR')
      .expect(403);

    expect(googleCalendarService.getConnectUrl).not.toHaveBeenCalled();
  });

  it('accepts the OAuth callback without an authenticated session', async () => {
    await request(app.getHttpServer())
      .get('/google-calendar/callback?code=code-123&state=signed-state')
      .expect(200);

    expect(googleCalendarService.handleCallback).toHaveBeenCalledWith(
      'code-123',
      'signed-state',
    );
  });

  it('validates calendar query dates and rejects injection-like input', async () => {
    await request(app.getHttpServer())
      .get(
        "/visitas/calendario?desde=2026-07-01';DROP TABLE visitas;--&hasta=2026-07-31",
      )
      .set('x-mock-role', 'COORDINADOR')
      .expect(400);

    expect(visitasService.findCalendarForUser).not.toHaveBeenCalled();
  });

  it('validates calendar query uuid filters before reaching the service', async () => {
    await request(app.getHttpServer())
      .get(
        '/visitas/calendario?desde=2026-07-01&hasta=2026-07-31&profesionalSaludId=not-a-uuid',
      )
      .set('x-mock-role', 'COORDINADOR')
      .expect(400);

    expect(visitasService.findCalendarForUser).not.toHaveBeenCalled();
  });

  it('allows professionals to read calendar through the filtered endpoint', async () => {
    await request(app.getHttpServer())
      .get('/visitas/calendario?desde=2026-07-01&hasta=2026-07-31')
      .set('x-mock-role', 'PROFESIONAL')
      .expect(200);

    expect(visitasService.findCalendarForUser).toHaveBeenCalledWith(
      expect.objectContaining({ desde: '2026-07-01', hasta: '2026-07-31' }),
      expect.objectContaining({ rol: 'PROFESIONAL' }),
    );
  });

  it('allows coordinators to create visits and passes the authenticated user id', async () => {
    const payload = {
      pacienteId: randomUUID(),
      profesionalSaludId: randomUUID(),
      zonaId: randomUUID(),
      fechaProgramada: '2026-07-01',
      horaProgramada: '09:00',
      duracionEstimadaMin: 60,
      prioridad: 'NORMAL',
    };

    await request(app.getHttpServer())
      .post('/visitas')
      .set('x-mock-role', 'COORDINADOR')
      .send(payload)
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual(expect.objectContaining(payload));
      });

    expect(visitasService.create).toHaveBeenCalledWith(
      payload,
      expect.any(String),
    );
  });

  it('blocks professionals from creating visits', async () => {
    await request(app.getHttpServer())
      .post('/visitas')
      .set('x-mock-role', 'PROFESIONAL')
      .send({
        pacienteId: randomUUID(),
        profesionalSaludId: randomUUID(),
        fechaProgramada: '2026-07-01',
        horaProgramada: '09:00',
      })
      .expect(403);

    expect(visitasService.create).not.toHaveBeenCalled();
  });

  it('rejects malformed visit creation payload before reaching service', async () => {
    await request(app.getHttpServer())
      .post('/visitas')
      .set('x-mock-role', 'COORDINADOR')
      .send({
        pacienteId: 'not-a-uuid',
        profesionalSaludId: randomUUID(),
        fechaProgramada: '2026-07-01',
        horaProgramada: '25:99',
      })
      .expect(400);

    expect(visitasService.create).not.toHaveBeenCalled();
  });

  it('allows coordinators to reschedule visits through PATCH', async () => {
    const visitaId = randomUUID();
    const dto = { fechaProgramada: '2026-07-02', horaProgramada: '11:30' };

    await request(app.getHttpServer())
      .patch(`/visitas/${visitaId}`)
      .set('x-mock-role', 'COORDINADOR')
      .send(dto)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({ id: visitaId, ...dto }),
        );
      });

    expect(visitasService.update).toHaveBeenCalledWith(
      visitaId,
      dto,
      expect.any(String),
    );
  });

  it('blocks supervisors from canceling visits', async () => {
    await request(app.getHttpServer())
      .patch(`/visitas/${randomUUID()}/cancelar`)
      .set('x-mock-role', 'SUPERVISOR')
      .send({ observacionCancelacion: 'No corresponde' })
      .expect(403);

    expect(visitasService.cancelar).not.toHaveBeenCalled();
  });

  it('allows coordinators to retry Google Calendar sync for a visit', async () => {
    const visitaId = randomUUID();

    await request(app.getHttpServer())
      .post(`/visitas/${visitaId}/google-calendar/sync`)
      .set('x-mock-role', 'COORDINADOR')
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            id: visitaId,
            googleCalendarSyncStatus: 'SYNCED',
          }),
        );
      });

    expect(visitasService.resyncGoogleCalendar).toHaveBeenCalledWith(
      visitaId,
      expect.any(String),
    );
  });

  it('allows coordinators to inspect Google Calendar sync logs', async () => {
    const visitaId = randomUUID();

    await request(app.getHttpServer())
      .get(`/visitas/${visitaId}/google-calendar/logs`)
      .set('x-mock-role', 'COORDINADOR')
      .expect(200);

    expect(visitasService.findGoogleCalendarLogs).toHaveBeenCalledWith(
      visitaId,
    );
  });

  it('allows coordinators to retry pending Google Calendar syncs', async () => {
    await request(app.getHttpServer())
      .post('/visitas/google-calendar/sync-pending')
      .set('x-mock-role', 'COORDINADOR')
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual({ attempted: 1, synced: 1, failed: 0 });
      });

    expect(visitasService.retryPendingGoogleCalendarSync).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it('blocks supervisors from retrying Google Calendar sync', async () => {
    await request(app.getHttpServer())
      .post(`/visitas/${randomUUID()}/google-calendar/sync`)
      .set('x-mock-role', 'SUPERVISOR')
      .expect(403);

    expect(visitasService.resyncGoogleCalendar).not.toHaveBeenCalled();
  });
});

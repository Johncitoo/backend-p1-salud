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
  canActivate: context => {
    const req = context.switchToHttp().getRequest();
    const role = (req.header('x-mock-role') ?? 'PROFESIONAL').toUpperCase() as AppRole;
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
    getConnectUrl: jest.fn(async () => ({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed' })),
    handleCallback: jest.fn(async () => ({ connected: true, profesionalSaludId: randomUUID(), syncEnabled: true })),
    getStatus: jest.fn(async () => ({ connected: true, profesionalSaludId: randomUUID(), syncEnabled: true })),
    disconnect: jest.fn(async () => ({ connected: false, profesionalSaludId: randomUUID(), syncEnabled: false })),
  };

  const visitasService = {
    findAllForUser: jest.fn(async () => []),
    findCalendarForUser: jest.fn(async () => []),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    resyncGoogleCalendar: jest.fn(async (id: string) => ({ id, googleCalendarSyncStatus: 'SYNCED' })),
    cambiarEstado: jest.fn(),
    cancelar: jest.fn(),
    remove: jest.fn(),
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
      .expect(response => {
        expect(response.body.authorizationUrl).toContain('accounts.google.com');
      });

    expect(googleCalendarService.getConnectUrl).toHaveBeenCalledWith(expect.objectContaining({ rol: 'PROFESIONAL' }));
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
      .get("/visitas/calendario?desde=2026-07-01';DROP TABLE visitas;--&hasta=2026-07-31")
      .set('x-mock-role', 'COORDINADOR')
      .expect(400);

    expect(visitasService.findCalendarForUser).not.toHaveBeenCalled();
  });

  it('validates calendar query uuid filters before reaching the service', async () => {
    await request(app.getHttpServer())
      .get('/visitas/calendario?desde=2026-07-01&hasta=2026-07-31&profesionalSaludId=not-a-uuid')
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

  it('allows coordinators to retry Google Calendar sync for a visit', async () => {
    const visitaId = randomUUID();

    await request(app.getHttpServer())
      .post(`/visitas/${visitaId}/google-calendar/sync`)
      .set('x-mock-role', 'COORDINADOR')
      .expect(201)
      .expect(response => {
        expect(response.body).toEqual(expect.objectContaining({ id: visitaId, googleCalendarSyncStatus: 'SYNCED' }));
      });

    expect(visitasService.resyncGoogleCalendar).toHaveBeenCalledWith(visitaId, expect.any(String));
  });

  it('blocks supervisors from retrying Google Calendar sync', async () => {
    await request(app.getHttpServer())
      .post(`/visitas/${randomUUID()}/google-calendar/sync`)
      .set('x-mock-role', 'SUPERVISOR')
      .expect(403);

    expect(visitasService.resyncGoogleCalendar).not.toHaveBeenCalled();
  });
});

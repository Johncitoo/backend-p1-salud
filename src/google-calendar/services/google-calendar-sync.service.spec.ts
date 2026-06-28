import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { ProfesionalGoogleCalendarConnection } from '../entities/profesional-google-calendar-connection.entity';
import { Visita } from '../../pacientes/entities/visita.entity';

const makeRepo = <T>() => ({
  findOne: jest.fn(),
  save: jest.fn(async (value: T) => value),
  create: jest.fn((value: Partial<T>) => value as T),
});

describe('GoogleCalendarSyncService', () => {
  const connection = {
    id: 'conn-1',
    profesionalSaludId: 'prof-1',
    usuarioId: 'user-1',
    calendarId: 'primary',
    accessTokenCiphertext: 'cipher',
    tokenEncryptionIv: 'iv',
    tokenEncryptionTag: 'tag',
    syncEnabled: true,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    deletedAt: null,
  } as ProfesionalGoogleCalendarConnection;

  const visita = {
    id: 'visita-1',
    pacienteId: 'pac-1',
    profesionalSaludId: 'prof-1',
    zonaId: 'zona-1',
    fechaProgramada: '2026-07-01',
    horaProgramada: '09:30:00',
    duracionEstimadaMin: 45,
    estado: 'PROGRAMADA',
    googleCalendarSyncAttempts: 0,
  } as Visita;

  let connectionsRepo: ReturnType<typeof makeRepo<ProfesionalGoogleCalendarConnection>>;
  let logsRepo: ReturnType<typeof makeRepo<any>>;
  let visitasRepo: ReturnType<typeof makeRepo<Visita>>;
  let googleClient: {
    createEvent: jest.Mock;
    updateEvent: jest.Mock;
    deleteEvent: jest.Mock;
    refreshToken: jest.Mock;
  };
  let tokenEncryption: { decrypt: jest.Mock; encrypt: jest.Mock };
  let service: GoogleCalendarSyncService;

  beforeEach(() => {
    connectionsRepo = makeRepo<ProfesionalGoogleCalendarConnection>();
    logsRepo = makeRepo();
    visitasRepo = makeRepo<Visita>();
    googleClient = {
      createEvent: jest.fn().mockResolvedValue({ id: 'g-event-1', etag: 'etag-1', htmlLink: 'https://calendar/event' }),
      updateEvent: jest.fn().mockResolvedValue({ id: 'g-event-1', etag: 'etag-2', htmlLink: 'https://calendar/event' }),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
      refreshToken: jest.fn(),
    };
    tokenEncryption = {
      decrypt: jest.fn().mockReturnValue(JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' })),
      encrypt: jest.fn(),
    };

    connectionsRepo.findOne.mockResolvedValue(connection);
    service = new GoogleCalendarSyncService(
      connectionsRepo as any,
      logsRepo as any,
      visitasRepo as any,
      googleClient as any,
      tokenEncryption as any,
    );
  });

  it('builds a Google Calendar payload with start and end', () => {
    const payload = service.buildEventPayload(visita);

    expect(payload.summary).toBe('Visita domiciliaria');
    expect(payload.start).toEqual({ dateTime: '2026-07-01T09:30:00', timeZone: 'America/Santiago' });
    expect(payload.end).toEqual({ dateTime: '2026-07-01T10:15:00', timeZone: 'America/Santiago' });
  });

  it('creates an event for a newly created visit', async () => {
    await service.syncCreatedVisit({ ...visita });

    expect(googleClient.createEvent).toHaveBeenCalledWith('primary', 'access-token', expect.objectContaining({ summary: 'Visita domiciliaria' }));
    expect(visitasRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      googleCalendarEventId: 'g-event-1',
      googleCalendarSyncStatus: 'SYNCED',
      googleCalendarSyncAttempts: 1,
    }));
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', status: 'SUCCESS' }));
  });

  it('marks the visit as failed when Google rejects the sync', async () => {
    googleClient.createEvent.mockRejectedValue(new Error('google down'));

    await service.syncCreatedVisit({ ...visita });

    expect(visitasRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      googleCalendarSyncStatus: 'FAILED',
      googleCalendarLastError: 'google down',
      googleCalendarSyncAttempts: 1,
    }));
    expect(logsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', status: 'FAILED' }));
  });

  it('updates an existing event', async () => {
    await service.syncUpdatedVisit({ ...visita, googleCalendarEventId: 'g-event-1' } as Visita);

    expect(googleClient.updateEvent).toHaveBeenCalledWith('primary', 'g-event-1', 'access-token', expect.any(Object));
    expect(visitasRepo.save).toHaveBeenCalledWith(expect.objectContaining({ googleCalendarSyncStatus: 'SYNCED' }));
  });

  it('retries sync for an existing Google event', async () => {
    const result = await service.syncVisitNow({ ...visita, googleCalendarEventId: 'g-event-1' } as Visita);

    expect(googleClient.updateEvent).toHaveBeenCalledWith('primary', 'g-event-1', 'access-token', expect.any(Object));
    expect(result).toEqual(expect.objectContaining({ googleCalendarSyncStatus: 'SYNCED' }));
  });

  it('deletes an event when the visit is canceled', async () => {
    await service.syncCanceledVisit({ ...visita, googleCalendarEventId: 'g-event-1' } as Visita);

    expect(googleClient.deleteEvent).toHaveBeenCalledWith('primary', 'g-event-1', 'access-token');
    expect(visitasRepo.save).toHaveBeenCalledWith(expect.objectContaining({ googleCalendarSyncStatus: 'DELETED' }));
  });
});

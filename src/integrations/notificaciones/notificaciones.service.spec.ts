import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionEnviada } from './entities/notificacion-enviada.entity';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';

const makeEnviadasRepo = () => ({
  create: jest.fn((data: unknown) => data),
  save: jest.fn(async (data: unknown) => data),
  find: jest.fn(async () => []),
  findOne: jest.fn(async () => null),
});

// =========================================================
// Helpers y fixtures
// =========================================================

const makeConfigService = (overrides: Record<string, string> = {}): Partial<ConfigService> => ({
  get: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      NOTIFICATIONS_ENABLED: 'false',
      NOTIFICATIONS_URL: '',
      NOTIFICATIONS_PATH: '/notifications/send',
      NOTIFICATIONS_API_KEY: '',
      ...overrides,
    };
    return defaults[key];
  }),
});

const paciente: Paciente = {
  id: 'p-1111', rut: '12.345.678-5', nombres: 'Carlos', apellidos: 'Soto',
  telefono: '+56955555555', email: 'carlos@test.com', direccion: 'Av Test 123',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Paciente;

const profesionalUsuario = {
  nombres: 'Maria', apellidos: 'Perez',
  email: 'maria@test.com', telefono: '+56966666666',
};

const visita: Visita = {
  id: 'v-2222', pacienteId: 'p-1111', profesionalSaludId: 'prof-3333',
  fechaProgramada: '2026-07-01' as any, horaProgramada: '09:00:00' as any,
  estado: 'PROGRAMADA', version: 1,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Visita;

// =========================================================
// Tests
// =========================================================

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        { provide: ConfigService, useValue: makeConfigService() },
        { provide: getRepositoryToken(NotificacionEnviada), useValue: makeEnviadasRepo() },
      ],
    }).compile();

    service = module.get<NotificacionesService>(NotificacionesService);
    logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  // ----- Modo mock -----

  describe('modo mock (NOTIFICATIONS_ENABLED=false)', () => {
    it('loguea paciente_creado con email del paciente', async () => {
      await service.notificarPacienteCreado(paciente);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('paciente_creado'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('carlos@test.com'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"channel": "email"'));
    });

    it('loguea profesional_creado con datos del usuario', async () => {
      await service.notificarProfesionalCreado(profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('profesional_creado'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('maria@test.com'));
    });

    it('loguea visita_agendada con 2 notificaciones (paciente + profesional)', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('carlos@test.com'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('maria@test.com'));
    });

    it('incluye asuntos diferenciados para paciente y profesional', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);

      const calls = logSpy.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((c: string) => c.includes('Confirmación de tu hora de atención domiciliaria'))).toBe(true);
      expect(calls.some((c: string) => c.includes('Nueva visita agendada'))).toBe(true);
    });

    it('loguea visita_cancelada', async () => {
      await service.notificarVisitaCancelada(visita, paciente, profesionalUsuario);
      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('loguea visita_reprogramada', async () => {
      await service.notificarVisitaReprogramada(visita, paciente, profesionalUsuario);
      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('incluye fecha y hora formateadas en el cuerpo', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2026-07-01'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('09:00:00'));
    });

    it('solo notifica al paciente si profesionalUsuario es null', async () => {
      await service.notificarVisitaAgendada(visita, paciente, null);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('carlos@test.com'));
    });

    it('solo notifica al profesional si paciente es null', async () => {
      await service.notificarVisitaAgendada(visita, null, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('maria@test.com'));
    });

    it('no notifica si ambos son null', async () => {
      await service.notificarVisitaAgendada(visita, null, null);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('notifica solo al paciente cuando el profesional marca en camino', async () => {
      await service.notificarProfesionalEnCamino(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('profesional_en_camino'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('carlos@test.com'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Maria Perez'));
    });

    it('no notifica en camino si no hay paciente', async () => {
      await service.notificarProfesionalEnCamino(visita, null, profesionalUsuario);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // ----- Modo real -----

  describe('modo real (NOTIFICATIONS_ENABLED=true)', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificacionesService,
          { provide: ConfigService, useValue: makeConfigService({
            NOTIFICATIONS_ENABLED: 'true',
            NOTIFICATIONS_URL: 'https://notif.test.com',
            NOTIFICATIONS_PATH: '/notifications/send',
            NOTIFICATIONS_API_KEY: 'test-key-123',
          }) },
          { provide: getRepositoryToken(NotificacionEnviada), useValue: makeEnviadasRepo() },
        ],
      }).compile();

      service = module.get<NotificacionesService>(NotificacionesService);
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ notificationId: 'notif-123', jobId: 'job-123' }),
      } as Response);
    });

    it('envía POST al endpoint correcto con el header x-api-key', async () => {
      await service.notificarPacienteCreado(paciente);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://notif.test.com/notifications/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'test-key-123' }),
        }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.channel).toBe('email');
      expect(body.recipient.email).toBe('carlos@test.com');
      expect(body.subject).toBeTruthy();
      expect(body.body.email).toContain('Carlos Soto');
    });

    it('envía 2 POST para visita_agendada (paciente + profesional)', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('envía 1 POST para profesional_en_camino (solo paciente)', async () => {
      await service.notificarProfesionalEnCamino(visita, paciente, profesionalUsuario);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.recipient.email).toBe('carlos@test.com');
      expect(body.subject).toContain('en camino');
    });

    it('no lanza excepción si fetch falla', async () => {
      fetchSpy.mockRejectedValue(new Error('Connection refused'));
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      await expect(service.notificarPacienteCreado(paciente)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    });
  });
});

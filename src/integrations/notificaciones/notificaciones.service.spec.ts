import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificacionesService } from './notificaciones.service';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';

// =========================================================
// Helpers y fixtures
// =========================================================

const makeConfigService = (overrides: Record<string, string> = {}): Partial<ConfigService> => ({
  get: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      NOTIFICATIONS_ENABLED: 'false',
      NOTIFICATIONS_URL: '',
      NOTIFICATIONS_PATH: '/notifications',
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
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"plantilla": "paciente_creado"'));
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

    it('usa plantillas diferenciadas _paciente y _profesional', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);

      const calls = logSpy.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((c: string) => c.includes('"plantilla": "visita_agendada_paciente"'))).toBe(true);
      expect(calls.some((c: string) => c.includes('"plantilla": "visita_agendada_profesional"'))).toBe(true);
    });

    it('loguea visita_cancelada con prioridad alta', async () => {
      await service.notificarVisitaCancelada(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(2);
      const calls = logSpy.mock.calls.map((c: string[]) => c[0]);
      expect(calls.every((c: string) => c.includes('"prioridad": "alta"'))).toBe(true);
    });

    it('loguea visita_reprogramada con prioridad alta', async () => {
      await service.notificarVisitaReprogramada(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledTimes(2);
      const calls = logSpy.mock.calls.map((c: string[]) => c[0]);
      expect(calls.every((c: string) => c.includes('"prioridad": "alta"'))).toBe(true);
    });

    it('incluye fecha y hora formateadas en las variables', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"fecha": "2026-07-01"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"hora": "09:00:00"'));
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
            NOTIFICATIONS_PATH: '/api/send',
          }) },
        ],
      }).compile();

      service = module.get<NotificacionesService>(NotificacionesService);
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    });

    it('envía POST al endpoint correcto', async () => {
      await service.notificarPacienteCreado(paciente);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://notif.test.com/api/send',
        expect.objectContaining({ method: 'POST' }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.source).toBe('salud');
      expect(body.evento).toBe('paciente_creado');
      expect(body.destinatario.email).toBe('carlos@test.com');
    });

    it('envía 2 POST para visita_agendada (paciente + profesional)', async () => {
      await service.notificarVisitaAgendada(visita, paciente, profesionalUsuario);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('no lanza excepción si fetch falla', async () => {
      fetchSpy.mockRejectedValue(new Error('Connection refused'));
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      await expect(service.notificarPacienteCreado(paciente)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    });
  });
});

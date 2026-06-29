import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { Visita } from '../../pacientes/entities/visita.entity';
import { Zona } from '../../zonas/entities/zona.entity';
import { Especialidad } from '../../profesionales/entities/especialidad.entity';
import { ProfesionalSalud } from '../../profesionales/entities/profesional-salud.entity';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { FichaClinica } from '../../fichas-clinicas/entities/ficha-clinica.entity';

// =========================================================
// Helpers y fixtures
// =========================================================

const makeConfigService = (overrides: Record<string, string> = {}): Partial<ConfigService> => ({
  get: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      ANALYTICS_ENABLED: 'false',
      ANALYTICS_URL: '',
      ANALYTICS_EVENTS_PATH: '/events',
      ...overrides,
    };
    return defaults[key];
  }),
});

const zona: Zona = {
  id: 'z-1111', nombre: 'Zona Norte', descripcion: 'Sector norte', comuna: 'Antofagasta',
  region: 'Antofagasta', activa: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Zona;

const paciente: Paciente = {
  id: 'p-2222', rut: '12.345.678-5', nombres: 'Juan', apellidos: 'Soto',
  fechaNacimiento: new Date('1985-04-12'), sexo: 'M', telefono: '+56987654321',
  email: 'juan@test.com', direccion: 'Av Prueba 123',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Paciente;

const profesional: ProfesionalSalud = {
  id: 'prof-3333', usuarioId: 'u-4444', profesion: 'Enfermera',
  numeroRegistro: 'REG-001', activo: true,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as ProfesionalSalud;

const especialidad: Especialidad = {
  id: 'esp-5555', nombre: 'Cardiologia', descripcion: 'Atencion cardiovascular',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Especialidad;

const visita: Visita = {
  id: 'v-6666', pacienteId: 'p-2222', profesionalSaludId: 'prof-3333',
  zonaId: 'z-1111', creadaPorUsuarioId: 'u-4444',
  fechaProgramada: '2026-07-01' as any, horaProgramada: '10:30:00' as any,
  estado: 'PROGRAMADA', fechaHoraInicioReal: null, fechaHoraFinReal: null,
  version: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as Visita;

const ficha: FichaClinica = {
  id: 'f-7777', visitaId: 'v-6666', estado: 'BORRADOR',
  contenido: { motivo: 'Control general' },
  creadaPorUsuarioId: 'u-4444', actualizadaPorUsuarioId: null,
  version: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as FichaClinica;

// =========================================================
// Tests
// =========================================================

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  // ----- Modo mock (ANALYTICS_ENABLED=false) -----

  describe('modo mock (ANALYTICS_ENABLED=false)', () => {
    it('loguea zona_upsert sin hacer fetch', async () => {
      await service.sendZonaUpsertEvent(zona);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Analytics mock] Evento zona_upsert'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"zona_id": "z-1111"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"nombre": "Zona Norte"'));
    });

    it('loguea usuario_upsert con campos correctos', async () => {
      await service.sendUsuarioUpsertEvent({
        id: 'u-1111', nombres: 'Maria', apellidos: 'Perez',
        rut: '11.111.111-1', email: 'maria@test.com', telefono: '+569', activo: true,
      });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"usuario_id": "u-1111"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"nombres": "Maria"'));
    });

    it('loguea paciente_upsert con fecha_nacimiento formateada', async () => {
      await service.sendPacienteUpsertEvent(paciente);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"paciente_id": "p-2222"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"fecha_nacimiento": "1985-04-12"'));
    });

    it('loguea profesional_upsert con nombres del usuario', async () => {
      await service.sendProfesionalUpsertEvent(profesional, { nombres: 'Maria', apellidos: 'Perez' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"profesional_id": "prof-3333"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"nombres": "Maria"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"usuario_id": "u-4444"'));
    });

    it('loguea especialidad_upsert', async () => {
      await service.sendEspecialidadUpsertEvent(especialidad);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"especialidad_id": "esp-5555"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"nombre": "Cardiologia"'));
    });

    it('loguea visita_upsert con estado normalizado', async () => {
      await service.sendVisitUpsertEvent(visita);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"estado": "programada"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"completada": 0'));
    });

    it('loguea visita_upsert con estado completada y puntual', async () => {
      const completada = { ...visita, estado: 'REALIZADA', fechaHoraFinReal: new Date() } as Visita;
      await service.sendVisitUpsertEvent(completada, { puntual: true });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"estado": "completada"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"completada": 1'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"puntual": 1'));
    });

    it('loguea visita_inicio con fecha_inicio_real', async () => {
      const iniciada = { ...visita, fechaHoraInicioReal: new Date('2026-07-01T10:35:00Z') } as Visita;
      await service.sendVisitaInicioEvent(iniciada);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"visita_id": "v-6666"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"fecha_inicio_real": "2026-07-01T10:35:00.000Z"'));
    });

    it('no envía visita_inicio si fechaHoraInicioReal es null', async () => {
      await service.sendVisitaInicioEvent(visita);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('loguea visita_fin con datos de cierre', async () => {
      const finalizada = { ...visita, estado: 'REALIZADA', fechaHoraFinReal: new Date('2026-07-01T11:00:00Z') } as Visita;
      await service.sendVisitaFinEvent(finalizada, { puntual: true });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"visita_fin"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"completada": 1'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"puntual": 1'));
    });

    it('no envía visita_fin si fechaHoraFinReal es null', async () => {
      await service.sendVisitaFinEvent(visita);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('loguea ficha_upsert con estado mapeado BORRADOR→DRAFT', async () => {
      await service.sendFichaUpsertEvent(ficha, 0);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"estado": "DRAFT"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"tiene_adjuntos": "0"'));
    });

    it('loguea ficha_upsert con estado CERRADA→COMPLETED y adjuntos', async () => {
      const cerrada = { ...ficha, estado: 'CERRADA' } as FichaClinica;
      await service.sendFichaUpsertEvent(cerrada, 3);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"estado": "COMPLETED"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"tiene_adjuntos": "1"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"cantidad_adjuntos": "3"'));
    });

    it('loguea ficha_upsert con estado ANULADA→ARCHIVED', async () => {
      const anulada = { ...ficha, estado: 'ANULADA' } as FichaClinica;
      await service.sendFichaUpsertEvent(anulada, 0);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"estado": "ARCHIVED"'));
    });
  });

  // ----- Modo real (ANALYTICS_ENABLED=true) -----

  describe('modo real (ANALYTICS_ENABLED=true)', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          { provide: ConfigService, useValue: makeConfigService({
            ANALYTICS_ENABLED: 'true',
            ANALYTICS_URL: 'https://analisis.test.com',
            ANALYTICS_EVENTS_PATH: '/v1/events',
          }) },
        ],
      }).compile();

      service = module.get<AnalyticsService>(AnalyticsService);
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    });

    it('envía POST al endpoint correcto con payload', async () => {
      await service.sendZonaUpsertEvent(zona);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://analisis.test.com/v1/events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.source).toBe('salud');
      expect(body.event_type).toBe('zona_upsert');
      expect(body.payload.zona_id).toBe('z-1111');
    });

    it('loguea error si fetch falla sin lanzar excepción', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      await expect(service.sendZonaUpsertEvent(zona)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });

    it('loguea error si HTTP status no es ok', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      await expect(service.sendZonaUpsertEvent(zona)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
    });

    it('advierte si URL está vacía con ENABLED=true', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          { provide: ConfigService, useValue: makeConfigService({
            ANALYTICS_ENABLED: 'true',
            ANALYTICS_URL: '',
          }) },
        ],
      }).compile();

      const svc = module.get<AnalyticsService>(AnalyticsService);
      const warnSpy = jest.spyOn((svc as any).logger, 'warn').mockImplementation();

      await svc.sendZonaUpsertEvent(zona);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ANALYTICS_URL está vacío'));
    });
  });

  // ----- Mapeos de estados -----

  describe('normalización de estados de visita', () => {
    const cases: [string, string][] = [
      ['REALIZADA', 'completada'],
      ['FINALIZADA', 'completada'],
      ['EN_ATENCION', 'en_proceso'],
      ['EN_CAMINO', 'en_proceso'],
      ['CANCELADA', 'cancelada'],
      ['NO_REALIZADA', 'cancelada'],
      ['PROGRAMADA', 'programada'],
      ['REPROGRAMADA', 'programada'],
    ];

    test.each(cases)('estado %s → %s', async (input, expected) => {
      const v = { ...visita, estado: input } as Visita;
      await service.sendVisitUpsertEvent(v);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`"estado": "${expected}"`));
    });
  });
});

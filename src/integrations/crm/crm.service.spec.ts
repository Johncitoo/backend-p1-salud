import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CrmService } from './crm.service';
import { of, throwError } from 'rxjs';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { IncidenteSalud } from '../../incidentes-salud/entities/incidente-salud.entity';

describe('CrmService', () => {
  let service: CrmService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'CRM_API_URL') return 'http://mock-crm.url/api';
      if (key === 'CRM_API_KEY') return 'mock-key';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CrmService>(CrmService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('debeEnviarTicket', () => {
    it('envía a CRM los incidentes manuales (origen WEB/APP)', () => {
      expect(service.debeEnviarTicket({ origen: 'WEB' } as IncidenteSalud)).toBe(true);
      expect(service.debeEnviarTicket({ origen: 'APP' } as IncidenteSalud)).toBe(true);
      expect(service.debeEnviarTicket({ origen: 'web' } as IncidenteSalud)).toBe(true);
    });

    it('NO envía a CRM los incidentes automáticos del sistema ni de integración', () => {
      expect(service.debeEnviarTicket({ origen: 'SISTEMA' } as IncidenteSalud)).toBe(false);
      expect(service.debeEnviarTicket({ origen: 'INTEGRACION' } as IncidenteSalud)).toBe(false);
      expect(service.debeEnviarTicket({} as IncidenteSalud)).toBe(false);
    });
  });

  describe('crearTicket', () => {
    it('should create a ticket successfully', async () => {
      const payload = {
        asunto: 'Test',
        prioridad: 'alta' as any,
        sistema_origen: 'salud' as any,
        sistema_id: 'P01' as any,
        cliente_nombre: 'John Doe',
      };
      
      const responseData = { data: { ok: true, ticket: { id: '123' } } };
      mockHttpService.post.mockReturnValue(of(responseData));

      const result = await service.crearTicket(payload);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://mock-crm.url/api',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'mock-key',
          },
        },
      );
      expect(result).toEqual({ ok: true, ticket: { id: '123' } });
    });

    it('should catch error and return null if request fails', async () => {
      const payload = {
        asunto: 'Test Error',
        prioridad: 'baja' as any,
        sistema_origen: 'salud' as any,
        sistema_id: 'P01' as any,
        cliente_nombre: 'Jane Doe',
      };
      
      mockHttpService.post.mockReturnValue(throwError(() => new Error('API Error')));

      const result = await service.crearTicket(payload);

      expect(result).toBeNull();
    });
  });

  describe('consultarEstadoTicket', () => {
    it('should return ticket when successful', async () => {
      const ticket = {
        id: 't-123',
        asunto: 'Alerta de salud',
        estado: 'abierto',
        prioridad: 'media',
        resolucion: null,
        salud_ref: 'inc-123',
      };
      mockHttpService.get.mockReturnValue(of({ data: { ok: true, ticket } }));
      const result = await service.consultarEstadoTicket('t-123');
      expect(mockHttpService.get).toHaveBeenCalledWith('http://mock-crm.url/api/t-123?api_key=mock-key');
      expect(result).toEqual(ticket);
    });

    it('should return null when error occurs', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));
      const estado = await service.consultarEstadoTicket('t-123');
      expect(estado).toBeNull();
    });
  });

  describe('extractTicketId', () => {
    it('should extract ticket id from common CRM response shapes', () => {
      expect(service.extractTicketId({ ticket: { id: 't-1' } })).toBe('t-1');
      expect(service.extractTicketId({ id: 't-2' })).toBe('t-2');
      expect(service.extractTicketId({ data: { ticket: { id: 't-3' } } })).toBe('t-3');
      expect(service.extractTicketId({ ok: true })).toBeNull();
    });
  });

  describe('buildPayloadFromIncidente', () => {
    it('should build payload correctly with paciente', () => {
      const incidente = {
        id: 'inc-123',
        titulo: 'Fiebre',
        descripcion: 'Paciente con fiebre',
        severidad: 'ALTA',
        tipo: 'CLINICO',
      } as IncidenteSalud;

      const paciente = {
        nombres: 'Juan',
        apellidos: 'Perez',
        email: 'juan@example.com',
        telefono: '+56912345678',
      } as Paciente;

      const payload = service.buildPayloadFromIncidente(incidente, paciente);

      expect(payload).toEqual({
        asunto: 'Fiebre',
        descripcion: 'Paciente con fiebre',
        prioridad: 'alta',
        sistema_origen: 'salud',
        sistema_id: 'P01',
        cliente_nombre: 'Juan Perez',
        cliente_email: 'juan@example.com',
        cliente_telefono: '+56912345678',
        salud_ref: 'inc-123',
        contexto: JSON.stringify({ origen: 'SISTEMA', modulo: 'Incidentes Salud' }),
      });
    });

    it('should build payload with fallback for missing paciente', () => {
      const incidente = {
        id: 'inc-456',
        titulo: 'Falla Sensor',
        severidad: 'CRITICA',
      } as IncidenteSalud;

      const payload = service.buildPayloadFromIncidente(incidente, null);

      expect(payload).toEqual({
        asunto: 'Falla Sensor',
        descripcion: '',
        prioridad: 'critica',
        sistema_origen: 'salud',
        sistema_id: 'P01',
        cliente_nombre: 'Paciente Desconocido',
        cliente_email: 'no-reply@salud.cl',
        cliente_telefono: undefined,
        salud_ref: 'inc-456',
        contexto: JSON.stringify({ origen: 'SISTEMA', modulo: 'Incidentes Salud' }),
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { IncidentesService } from './incidentes.service';
import { IncidenteSalud } from '../../incidentes-salud/entities/incidente-salud.entity';

describe('IncidentesService (Proyecto 11 Integration)', () => {
  let service: IncidentesService;
  let httpServiceMock: any;
  let configServiceMock: any;

  // Incidente operacional que SÍ mapea al catálogo de Grupo 11.
  const incidenteOperacional: IncidenteSalud = {
    id: 'inc-123',
    titulo: 'Visita No Registrada en Tiempo',
    descripcion: 'El profesional no realizó check-in. Excedió el umbral de 60 min.',
    severidad: 'ALTA',
    estado: 'ABIERTO',
    tipo: 'VISITA_NO_REGISTRADA',
    pacienteId: 'paciente-456',
    visitaId: 'visita-789',
    createdAt: new Date('2026-07-08T05:33:29.000Z'),
    metadata: {},
  } as IncidenteSalud;

  beforeEach(async () => {
    httpServiceMock = { post: jest.fn() };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'INCIDENTES_API_URL') return 'http://mock.incidentes.api';
        if (key === 'INCIDENTES_API_KEY') return 'mock_secret_key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentesService,
        { provide: HttpService, useValue: httpServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<IncidentesService>(IncidentesService);
    // Evita esperas reales del backoff en los tests.
    jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  it('envía el incidente operacional en el formato acordado con Grupo 11', async () => {
    httpServiceMock.post.mockReturnValue(of({ data: 'ok' }));

    await service.enviarIncidente(incidenteOperacional);

    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'http://mock.incidentes.api',
      {
        sistema_id: 'P1',
        creado_en: '2026-07-08T05:33:29.000Z',
        payload: expect.objectContaining({
          // Obligatorios oficiales de Grupo 11
          titulo: 'Visita No Registrada en Tiempo',
          descripcion: 'El profesional no realizó check-in. Excedió el umbral de 60 min.',
          prioridad: 'alta', // ALTA -> alta
          // Extras propios (mapeados por ellos)
          eventId: 'inc-123',
          source: 'salud-domiciliaria',
          eventType: 'visit_not_registered',
          occurredAt: '2026-07-08T05:33:29.000Z',
          severity: 'high', // ALTA -> high
          status: 'pending', // ABIERTO -> pending
          patientId: 'paciente-456',
          visitId: 'visita-789',
        }),
      },
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'mock_secret_key' },
        timeout: 20_000,
      }),
    );
  });

  it('NO envía incidentes cuyo tipo no está en el catálogo (ej. IoT)', async () => {
    const incidenteIot = { ...incidenteOperacional, tipo: 'SIGNO_VITAL_ANORMAL' } as IncidenteSalud;

    await service.enviarIncidente(incidenteIot);

    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('con forzar=true envía un ticket manual (tipo no mapeado) con eventType genérico y tipo real en metadata', async () => {
    httpServiceMock.post.mockReturnValue(of({ data: 'ok' }));
    const ticketManual = {
      ...incidenteOperacional,
      tipo: 'SOLICITUD_SOPORTE',
      metadata: { canal: 'web' },
    } as IncidenteSalud;

    await service.enviarIncidente(ticketManual, { forzar: true });

    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'http://mock.incidentes.api',
      expect.objectContaining({
        payload: expect.objectContaining({
          eventType: 'follow_up_required', // eventType genérico del catálogo
          metadata: expect.objectContaining({
            canal: 'web', // se conserva la metadata original
            tipoInterno: 'SOLICITUD_SOPORTE', // + el tipo real del ticket
            origenTicket: 'crm',
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it('sin forzar, un ticket manual (tipo no mapeado) NO se envía', async () => {
    const ticketManual = { ...incidenteOperacional, tipo: 'SOLICITUD_SOPORTE' } as IncidenteSalud;

    await service.enviarIncidente(ticketManual);

    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('reintenta ante fallos y no lanza excepción (manejo silencioso)', async () => {
    httpServiceMock.post.mockReturnValue(throwError(() => new Error('Network error')));

    await expect(service.enviarIncidente(incidenteOperacional)).resolves.not.toThrow();
    // 3 intentos con backoff (mockeado)
    expect(httpServiceMock.post).toHaveBeenCalledTimes(3);
  });

  it('deja de reintentar apenas un intento tiene éxito', async () => {
    httpServiceMock.post
      .mockReturnValueOnce(throwError(() => new Error('cold start')))
      .mockReturnValueOnce(of({ data: 'ok' }));

    await service.enviarIncidente(incidenteOperacional);

    expect(httpServiceMock.post).toHaveBeenCalledTimes(2);
  });
});

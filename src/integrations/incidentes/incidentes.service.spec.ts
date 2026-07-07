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

  const mockIncidente: IncidenteSalud = {
    id: 'inc-123',
    titulo: 'Paciente sin conexión',
    descripcion: 'Se perdió telemetría del paciente',
    severidad: 'ALTA',
    estado: 'ABIERTO',
    tipo: 'FALLA_CONEXION',
    pacienteId: 'paciente-456',
  } as IncidenteSalud;

  beforeEach(async () => {
    httpServiceMock = {
      post: jest.fn(),
    };

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
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debería formatear y enviar correctamente un incidente al webhook externo', async () => {
    httpServiceMock.post.mockReturnValue(of({ data: 'ok' }));

    await service.enviarIncidente(mockIncidente);

    expect(httpServiceMock.post).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'http://mock.incidentes.api',
      expect.objectContaining({
        sistema_id: 'P01',
        payload: expect.objectContaining({
          titulo: 'Paciente sin conexión',
          descripcion: 'Se perdió telemetría del paciente',
          prioridad: 'alta', // Mapeado de ALTA
          incidente_interno_id: 'inc-123',
        }),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock_secret_key',
        },
      }
    );
  });

  it('no debería lanzar excepción si la petición HTTP falla (manejo silencioso)', async () => {
    httpServiceMock.post.mockReturnValue(throwError(() => new Error('Network error')));

    // No debe hacer throw de error, debe atraparlo y hacer log
    await expect(service.enviarIncidente(mockIncidente)).resolves.not.toThrow();
  });
});

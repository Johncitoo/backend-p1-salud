import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IoTService, IoTTelemetryReading } from './iot.service';
import { PacienteSensor } from './entities/paciente-sensor.entity';
import { MedicionesClinicasService } from '../../mediciones-clinicas/mediciones-clinicas.service';
import { VariablesClinicasService } from '../../variables-clinicas/variables-clinicas.service';
import { AlertasService } from '../../alertas/alertas.service';

describe('IoTService', () => {
  let service: IoTService;
  
  const mockConfigService = {
    get: jest.fn().mockReturnValue('true'),
  };
  
  const mockPacienteSensorRepo = {
    findOne: jest.fn(),
  };

  const mockMedicionesClinicasService = {
    create: jest.fn(),
  };

  const mockVariablesClinicasService = {
    findByCodigo: jest.fn(),
  };

  const mockAlertasService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IoTService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(PacienteSensor), useValue: mockPacienteSensorRepo },
        { provide: MedicionesClinicasService, useValue: mockMedicionesClinicasService },
        { provide: VariablesClinicasService, useValue: mockVariablesClinicasService },
        { provide: AlertasService, useValue: mockAlertasService },
      ],
    }).compile();

    service = module.get<IoTService>(IoTService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMediciones', () => {
    it('should map telemetry to clinical variables', () => {
      const reading: IoTTelemetryReading = {
        sensorId: 'OXI-001',
        assetId: 'PATIENT-001',
        sensorType: 'pulse_oximeter',
        batteryLevel: 90,
        connectionStatus: 'connected',
        oxygenSaturation: 98,
        heartRate: 75,
      };

      const mediciones = service.extractMediciones(reading);
      
      expect(mediciones).toHaveLength(2);
      expect(mediciones).toContainEqual({ codigoVariable: 'saturacion_oxigeno', valor: 98 });
      expect(mediciones).toContainEqual({ codigoVariable: 'frecuencia_cardiaca', valor: 75 });
    });
  });
});

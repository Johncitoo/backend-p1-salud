import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IoTService, IoTTelemetryReading, IoTAlert } from './iot.service';
import { PacienteSensor } from './entities/paciente-sensor.entity';
import { MedicionesClinicasService } from '../../mediciones-clinicas/mediciones-clinicas.service';
import { VariablesClinicasService } from '../../variables-clinicas/variables-clinicas.service';
import { AlertasService } from '../../alertas/alertas.service';
import { IncidentesSaludService } from '../../incidentes-salud/incidentes-salud.service';

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
    findAll: jest.fn(),
  };

  const mockVariablesClinicasService = {
    findByCodigo: jest.fn(),
  };

  const mockAlertasService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  const mockIncidentesSaludService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('true');
    mockMedicionesClinicasService.findAll.mockResolvedValue([]);
    mockAlertasService.findAll.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IoTService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(PacienteSensor), useValue: mockPacienteSensorRepo },
        { provide: MedicionesClinicasService, useValue: mockMedicionesClinicasService },
        { provide: VariablesClinicasService, useValue: mockVariablesClinicasService },
        { provide: AlertasService, useValue: mockAlertasService },
        { provide: IncidentesSaludService, useValue: mockIncidentesSaludService },
      ],
    }).compile();

    service = module.get<IoTService>(IoTService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMediciones', () => {
    it('mapea pulse_oximeter (saturacion + frecuencia cardiaca)', () => {
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

    it('mapea thermometer (temperatura)', () => {
      const reading: IoTTelemetryReading = {
        sensorId: 'TERM-001',
        assetId: 'PATIENT-002',
        sensorType: 'thermometer',
        batteryLevel: 80,
        connectionStatus: 'connected',
        temperature: 37.8,
      };

      const mediciones = service.extractMediciones(reading);

      expect(mediciones).toEqual([{ codigoVariable: 'temperatura', valor: 37.8 }]);
    });

    it('mapea glucometer (glicemia capilar)', () => {
      const reading: IoTTelemetryReading = {
        sensorId: 'GLUCO-001',
        assetId: 'PATIENT-003',
        sensorType: 'glucometer',
        batteryLevel: 70,
        connectionStatus: 'connected',
        glucoseLevel: 145,
      };

      const mediciones = service.extractMediciones(reading);

      expect(mediciones).toEqual([{ codigoVariable: 'glicemia_capilar', valor: 145 }]);
    });

    it('mapea sphygmomanometer (presion sistolica + diastolica)', () => {
      const reading: IoTTelemetryReading = {
        sensorId: 'PRES-001',
        assetId: 'PATIENT-004',
        sensorType: 'sphygmomanometer',
        batteryLevel: 60,
        connectionStatus: 'connected',
        systolicPressure: 120,
        diastolicPressure: 80,
      };

      const mediciones = service.extractMediciones(reading);

      expect(mediciones).toHaveLength(2);
      expect(mediciones).toContainEqual({ codigoVariable: 'presion_arterial_sistolica', valor: 120 });
      expect(mediciones).toContainEqual({ codigoVariable: 'presion_arterial_diastolica', valor: 80 });
    });

    it('no incluye campos ausentes ni NaN', () => {
      const reading: IoTTelemetryReading = {
        sensorId: 'OXI-002',
        assetId: 'PATIENT-005',
        sensorType: 'pulse_oximeter',
        batteryLevel: 50,
        connectionStatus: 'disconnected',
        oxygenSaturation: NaN,
      };

      expect(service.extractMediciones(reading)).toEqual([]);
    });
  });

  describe('processTelemetryReading', () => {
    const reading: IoTTelemetryReading = {
      sensorId: 'OXI-001',
      assetId: 'PATIENT-001',
      sensorType: 'pulse_oximeter',
      batteryLevel: 90,
      connectionStatus: 'connected',
      oxygenSaturation: 96,
      createdAt: '2026-07-07T10:00:00Z',
    };

    it('no hace nada si no hay un paciente activo vinculado al assetId', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue(null);

      await service.processTelemetryReading(reading);

      expect(mockMedicionesClinicasService.create).not.toHaveBeenCalled();
    });

    it('omite la variable si no existe en el catalogo clinico', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      mockVariablesClinicasService.findByCodigo.mockResolvedValue(null);

      await service.processTelemetryReading(reading);

      expect(mockMedicionesClinicasService.create).not.toHaveBeenCalled();
    });

    it('no duplica si ya existe una medicion con la misma fecha exacta', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      mockVariablesClinicasService.findByCodigo.mockResolvedValue({ id: 'var-1' });
      mockMedicionesClinicasService.findAll.mockResolvedValue([{ id: 'med-existente' }]);

      await service.processTelemetryReading(reading);

      expect(mockMedicionesClinicasService.create).not.toHaveBeenCalled();
    });

    it('guarda la medicion con origen IOT cuando todo es valido', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      mockVariablesClinicasService.findByCodigo.mockResolvedValue({ id: 'var-saturacion' });
      mockMedicionesClinicasService.findAll.mockResolvedValue([]);

      await service.processTelemetryReading(reading);

      expect(mockMedicionesClinicasService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pacienteId: 'pac-1',
          variableClinicaId: 'var-saturacion',
          valorNumero: 96,
          origen: 'IOT',
        }),
      );
    });
  });

  describe('processAlertReading', () => {
    const baseAlert: IoTAlert = {
      sensorId: 'OXI-001',
      type: 'low_battery',
      severity: 'LOW',
      message: 'Bateria al 10%',
      resolved: false,
    };

    it('no hace nada si no hay un paciente activo vinculado al sensorId', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue(null);

      await service.processAlertReading(baseAlert);

      expect(mockAlertasService.create).not.toHaveBeenCalled();
    });

    it('no duplica si ya existe una alerta identica (mismo mensaje y tipo)', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      mockAlertasService.findAll.mockResolvedValue([
        { mensaje: baseAlert.message, tipo: `IOT_${baseAlert.type.toUpperCase()}` },
      ]);

      await service.processAlertReading(baseAlert);

      expect(mockAlertasService.create).not.toHaveBeenCalled();
    });

    it('alerta técnica low_battery: alerta BAJA + incidente técnico severidad BAJA', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });

      await service.processAlertReading(baseAlert); // type: 'low_battery'

      expect(mockAlertasService.create).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: 'pac-1', prioridad: 'BAJA' }),
      );
      expect(mockIncidentesSaludService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pacienteId: 'pac-1',
          tipo: 'FALLA_DISPOSITIVO',
          severidad: 'BAJA',
          estado: 'ABIERTO',
          origen: 'SISTEMA',
        }),
      );
    });

    it('alerta técnica sensor_offline con severity critical: sube a MEDIA (respeta Grupo 8)', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      const offlineAlert: IoTAlert = { ...baseAlert, type: 'sensor_offline', severity: 'critical', message: 'Sensor sin conexión' };

      await service.processAlertReading(offlineAlert);

      expect(mockAlertasService.create).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: 'pac-1', prioridad: 'MEDIA' }),
      );
      expect(mockIncidentesSaludService.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'FALLA_SENSOR', severidad: 'MEDIA' }),
      );
    });

    it('alerta técnica low_battery con severity critical: sube a MEDIA (respeta Grupo 8)', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      const critBattery: IoTAlert = { ...baseAlert, type: 'low_battery', severity: 'critical', message: 'Battery level is low: 5%' };

      await service.processAlertReading(critBattery);

      expect(mockIncidentesSaludService.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'FALLA_DISPOSITIVO', severidad: 'MEDIA' }),
      );
    });

    it('alerta clínica con warning: alerta ALTA + incidente clínico severidad ALTA', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      const clinica: IoTAlert = {
        ...baseAlert,
        type: 'oxygen_saturation_low',
        severity: 'warning',
        message: 'Low oxygen saturation: 90%',
      };

      await service.processAlertReading(clinica);

      expect(mockAlertasService.create).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: 'pac-1', prioridad: 'ALTA' }),
      );
      expect(mockIncidentesSaludService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pacienteId: 'pac-1',
          tipo: 'SIGNO_VITAL_ANORMAL',
          severidad: 'ALTA',
          estado: 'ABIERTO',
          origen: 'SISTEMA',
        }),
      );
    });

    it('alerta clínica con critical: sube a CRITICA (respeta Grupo 8)', async () => {
      mockPacienteSensorRepo.findOne.mockResolvedValue({ pacienteId: 'pac-1' });
      const clinicaCritica: IoTAlert = {
        ...baseAlert,
        type: 'oxygen_saturation_low',
        severity: 'critical',
        message: 'Low oxygen saturation: 78%',
      };

      await service.processAlertReading(clinicaCritica);

      expect(mockAlertasService.create).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: 'pac-1', prioridad: 'CRITICA' }),
      );
      expect(mockIncidentesSaludService.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'SIGNO_VITAL_ANORMAL', severidad: 'CRITICA' }),
      );
    });
  });

  describe('desenvolver respuestas paginadas de la API real del Grupo 8', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'IOT_ENABLED') return 'true';
        if (key === 'IOT_API_URL') return 'https://iot-platform-backend-bm5b.onrender.com';
        return undefined;
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('getReadingsBySensor desenvuelve el envoltorio { data, page, limit, total }', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ sensorId: 'OXI-001' }], page: 1, limit: 10, total: 776 }),
      }) as unknown as typeof fetch;

      const readings = await service.getReadingsBySensor('OXI-001');

      expect(Array.isArray(readings)).toBe(true);
      expect(readings).toEqual([{ sensorId: 'OXI-001' }]);
    });

    it('getAlertsBySensor desenvuelve el envoltorio { data, page, limit, total }', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ sensorId: 'OXI-001', severity: 'warning' }], page: 1, limit: 10, total: 5 }),
      }) as unknown as typeof fetch;

      const alerts = await service.getAlertsBySensor('OXI-001');

      expect(alerts).toEqual([{ sensorId: 'OXI-001', severity: 'warning' }]);
    });

    it('getLatestReading NO intenta desenvolver el objeto plano que ya devuelve la API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sensorId: 'GLUCO-192', glucoseLevel: 73 }),
      }) as unknown as typeof fetch;

      const reading = await service.getLatestReading();

      expect(reading).toEqual({ sensorId: 'GLUCO-192', glucoseLevel: 73 });
    });

    it('getDeviceCatalog devuelve la respuesta paginada completa (no solo el array)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ sensorId: 'OXI-001', assetId: 'PATIENT-001', sensorType: 'pulse_oximeter' }],
          page: 1,
          limit: 25,
          total: 250,
        }),
      }) as unknown as typeof fetch;

      const catalog = await service.getDeviceCatalog({ page: 1, limit: 25, sensorType: 'pulse_oximeter', search: 'OXI' });

      expect(catalog).toEqual(
        expect.objectContaining({ page: 1, limit: 25, total: 250 }),
      );
      expect(catalog?.data).toHaveLength(1);

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/sensors/devices?');
      expect(calledUrl).toContain('sensorType=pulse_oximeter');
      expect(calledUrl).toContain('search=OXI');
    });
  });
});

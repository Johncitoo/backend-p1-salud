import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('IoT Webhook (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/iot/webhook/telemetry (POST) should process telemetry', () => {
    return request(app.getHttpServer())
      .post('/iot/webhook/telemetry')
      .send({
        sensorId: 'OXI-001',
        assetId: 'PATIENT-001',
        sensorType: 'pulse_oximeter',
        batteryLevel: 90,
        connectionStatus: 'connected',
        oxygenSaturation: 98,
        heartRate: 75,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.processed).toBe(1);
      });
  });

  it('/iot/webhook/alerts (POST) should process alerts', () => {
    return request(app.getHttpServer())
      .post('/iot/webhook/alerts')
      .send({
        sensorId: 'OXI-001',
        type: 'LOW_BATTERY',
        severity: 'LOW',
        message: 'Batería del oxímetro al 10%',
        resolved: false,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.processed).toBe(1);
      });
  });
});

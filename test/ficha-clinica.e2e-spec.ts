// Forzar PostgreSQL — NODE_ENV=test activa SQLite en AppModule
process.env.NODE_ENV = 'e2e';
process.env.AUTH_MODE = 'mock';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const AUTH = {
  'x-mock-role': 'ADMIN',
  'x-identity-user-id': 'usr-admin-01',
};

const AUTH_PROF = {
  'x-mock-role': 'PROFESIONAL',
  'x-identity-user-id': 'usr-prof-01',
};

describe('Ficha Clinica — E2E (modelo hibrido)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let visitaId: string;
  let pacienteId: string;
  let varPAId: string;
  let varTempId: string;
  let plantillaId: string;

  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (plantillaId) {
        await dataSource.query(`DELETE FROM plantilla_ficha_campos WHERE plantilla_ficha_id = $1`, [plantillaId]);
        await dataSource.query(`DELETE FROM plantillas_ficha WHERE id = $1`, [plantillaId]);
      }
      if (varPAId) await dataSource.query(`UPDATE variables_clinicas SET deleted_at = NOW() WHERE id = $1`, [varPAId]);
      if (varTempId) await dataSource.query(`UPDATE variables_clinicas SET deleted_at = NOW() WHERE id = $1`, [varTempId]);
    }
    await app?.close();
  });

  // ==========================================================
  // ETAPA 1: Variables clínicas CRUD
  // ==========================================================
  describe('ETAPA 1 — Variables clinicas CRUD', () => {
    it('POST /variables-clinicas crea variable NUMERO con rango', async () => {
      const res = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: 'PA_E2E', nombre: 'PA sistolica E2E', tipoDato: 'NUMERO', unidad: 'mmHg', categoria: 'SIGNOS_VITALES', valorMinimo: 60, valorMaximo: 250 })
        .expect(201);

      varPAId = res.body.id;
      expect(varPAId).toBeDefined();
      expect(res.body.codigo).toBe('PA_E2E');
      expect(res.body.valorMinimo).toBe(60);
    });

    it('POST segunda variable', async () => {
      const res = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: 'TEMP_E2E', nombre: 'Temperatura E2E', tipoDato: 'NUMERO', unidad: 'C', categoria: 'SIGNOS_VITALES', valorMinimo: 30, valorMaximo: 45 })
        .expect(201);

      varTempId = res.body.id;
      expect(varTempId).toBeDefined();
    });

    it('GET /variables-clinicas lista todas', async () => {
      const res = await request(app.getHttpServer())
        .get('/variables-clinicas')
        .set(AUTH)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(10);
    });

    it('GET /variables-clinicas filtra por categoria', async () => {
      const res = await request(app.getHttpServer())
        .get('/variables-clinicas?categoria=SIGNOS_VITALES')
        .set(AUTH)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /variables-clinicas/:id retorna una especifica', async () => {
      const res = await request(app.getHttpServer())
        .get(`/variables-clinicas/${varPAId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.codigo).toBe('PA_E2E');
    });

    it('PATCH /variables-clinicas/:id actualiza nombre', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/variables-clinicas/${varPAId}`)
        .set(AUTH)
        .send({ nombre: 'PA sistolica E2E actualizada' })
        .expect(200);

      expect(res.body.nombre).toContain('actualizada');
    });

    it('POST validation: rechaza falta de tipoDato', async () => {
      await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: 'BAD', nombre: 'Bad' })
        .expect(400);
    });
  });

  // ==========================================================
  // ETAPA 2: Plantillas y campos
  // ==========================================================
  describe('ETAPA 2 — Plantillas de ficha', () => {
    it('POST /plantillas-ficha crea plantilla', async () => {
      const res = await request(app.getHttpServer())
        .post('/plantillas-ficha')
        .set(AUTH)
        .send({ codigo: 'E2E_PLANTILLA', nombre: 'Plantilla E2E', tipoAtencion: 'CONTROL' })
        .expect(201);

      plantillaId = res.body.id;
      expect(plantillaId).toBeDefined();
    });

    it('POST /plantillas-ficha/:id/campos crea campo TEXTO_LIBRE', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({ codigoCampo: 'motivo', etiqueta: 'Motivo de atencion', tipoCampo: 'TEXTO_LIBRE', orden: 1, obligatorio: true })
        .expect(201);
    });

    it('POST /plantillas-ficha/:id/campos crea campo VARIABLE_CLINICA', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({ codigoCampo: 'PA_SIST', etiqueta: 'PA sistolica', tipoCampo: 'VARIABLE_CLINICA', variableClinicaId: varPAId, orden: 2, obligatorio: true })
        .expect(201);
    });

    it('POST campo: rechaza VARIABLE_CLINICA sin variableClinicaId', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({ codigoCampo: 'BAD', etiqueta: 'Bad', tipoCampo: 'VARIABLE_CLINICA', orden: 3 })
        .expect(400);
    });

    it('POST campo: rechaza codigoCampo duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({ codigoCampo: 'PA_SIST', etiqueta: 'Duplicado', tipoCampo: 'TEXTO_LIBRE', orden: 4 })
        .expect(400);
    });

    it('GET /plantillas-ficha/:id retorna plantilla con campos', async () => {
      const res = await request(app.getHttpServer())
        .get(`/plantillas-ficha/${plantillaId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.campos).toBeDefined();
      expect(res.body.campos.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================
  // ETAPA 3: Ficha clínica + extracción automática a mediciones
  // ==========================================================
  describe('ETAPA 3 — Ficha clinica + extraccion a mediciones', () => {
    let fichaId: string;

    beforeAll(async () => {
      if (dataSource?.isInitialized) {
        const visitas = await dataSource.query(`SELECT v.id, v.paciente_id FROM visitas v WHERE v.deleted_at IS NULL LIMIT 1`);
        if (visitas.length > 0) {
          visitaId = visitas[0].id;
          pacienteId = visitas[0].paciente_id;
        }
      }
    });

    it('existe visita/paciente en la BD', () => {
      expect(visitaId).toBeDefined();
      expect(pacienteId).toBeDefined();
    });

    it('POST /fichas-clinicas crea ficha y sincroniza mediciones', async () => {
      const res = await request(app.getHttpServer())
        .post('/fichas-clinicas')
        .set(AUTH)
        .send({
          visitaId,
          plantillaFichaId: plantillaId,
          contenido: { motivo: 'Control de rutina', PA_SIST: 120 },
        })
        .expect(201);

      fichaId = res.body.id;
      expect(fichaId).toBeDefined();
      expect(res.body.estado).toBe('BORRADOR');
      expect(res.body.contenido.PA_SIST).toBe(120);
    });

    it('mediciones se crearon automaticamente desde el contenido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const pa = res.body.find((m: { variableClinicaId: string }) => m.variableClinicaId === varPAId);
      expect(pa).toBeDefined();
      expect(Number(pa.valorNumero)).toBe(120);
    });

    it('campos TEXTO_LIBRE no generan mediciones', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      // motivo es TEXTO_LIBRE = no debe existir como variableClinicaId
      const motivoMediciones = res.body.find((m: { variableClinicaId: string }) =>
        m.variableClinicaId === 'motivo',
      );
      expect(motivoMediciones).toBeUndefined();
    });

    it('PATCH /fichas-clinicas actualiza y re-sincroniza mediciones', async () => {
      await request(app.getHttpServer())
        .patch(`/fichas-clinicas/${fichaId}`)
        .set(AUTH)
        .send({ contenido: { motivo: 'Actualizado', PA_SIST: 130 } })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      const activas = res.body.filter((m: { deletedAt: null | string; variableClinicaId: string }) =>
        m.variableClinicaId === varPAId && m.deletedAt === null,
      );
      expect(activas.length).toBeGreaterThanOrEqual(1);
      expect(Number(activas[0].valorNumero)).toBe(130);
    });

    it('PATCH /fichas-clinicas/:id/cerrar cierra la ficha', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/fichas-clinicas/${fichaId}/cerrar`)
        .set(AUTH)
        .expect(200);

      expect(res.body.estado).toBe('CERRADA');
    });

    it('rechaza cerrar ficha ya cerrada', async () => {
      await request(app.getHttpServer())
        .patch(`/fichas-clinicas/${fichaId}/cerrar`)
        .set(AUTH)
        .expect(400);
    });
  });

  // ==========================================================
  // ETAPA 4: Mediciones manuales
  // ==========================================================
  describe('ETAPA 4 — Mediciones manuales', () => {
    it('POST /mediciones-clinicas crea medicion manual', async () => {
      const res = await request(app.getHttpServer())
        .post('/mediciones-clinicas')
        .set(AUTH)
        .send({ pacienteId, variableClinicaId: varTempId, valorNumero: 36.5, origen: 'MANUAL', unidad: 'C' })
        .expect(201);

      expect(res.body.origen).toBe('MANUAL');
      expect(Number(res.body.valorNumero)).toBe(36.5);
    });

    it('GET /mediciones-clinicas filtra por pacienteId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?pacienteId=${pacienteId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================
  // ETAPA 5: Soft delete
  // ==========================================================
  describe('ETAPA 5 — Soft delete en variables', () => {
    it('DELETE soft-deletea y luego da 404', async () => {
      const tempV = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: 'DEL_E2E', nombre: 'To delete E2E', tipoDato: 'TEXTO' });

      const id = tempV.body.id;

      await request(app.getHttpServer())
        .delete(`/variables-clinicas/${id}`)
        .set(AUTH)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/variables-clinicas/${id}`)
        .set(AUTH)
        .expect(404);
    });
  });

  // ==========================================================
  // ETAPA 6: RBAC
  // ==========================================================
  describe('ETAPA 6 — RBAC', () => {
    it('PROFESIONAL no puede DELETE variables (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/variables-clinicas/${varPAId}`)
        .set(AUTH_PROF)
        .expect(403);
    });

    it('sin headers de auth da 401', async () => {
      await request(app.getHttpServer())
        .get('/variables-clinicas')
        .expect(401);
    });
  });
});


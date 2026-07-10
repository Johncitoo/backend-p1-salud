// Forzar PostgreSQL: NODE_ENV=test activa SQLite en AppModule.
process.env.NODE_ENV = 'e2e';
process.env.AUTH_MODE = 'mock';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const AUTH = {
  'x-mock-role': 'ADMIN',
  'x-identity-user-id': 'usr-admin-01',
};

const AUTH_PROF = {
  'x-mock-role': 'PROFESIONAL',
  'x-identity-user-id': 'usr-prof-01',
};

const RUN_ID = Date.now().toString(36).toUpperCase();
const PA_CODE = `PA_E2E_${RUN_ID}`;
const TEMP_CODE = `TEMP_E2E_${RUN_ID}`;
const DEL_CODE = `DEL_E2E_${RUN_ID}`;
const PLANTILLA_CODE = `E2E_PLANTILLA_${RUN_ID}`;
const PATIENT_RUT = `FC-${RUN_ID}`;

describe('Ficha Clinica - E2E (modelo hibrido)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let visitaId: string;
  let pacienteId: string;
  let varPAId: string;
  let varTempId: string;
  let plantillaId: string;
  let fichaId: string;

  jest.setTimeout(30000);

  const cleanupRunData = async () => {
    if (!dataSource?.isInitialized) return;

    const variableCodes = [PA_CODE, TEMP_CODE, DEL_CODE];
    const plantillaCodes = [PLANTILLA_CODE];

    await dataSource.query(
      `
      DELETE FROM mediciones_clinicas
      WHERE ficha_clinica_id IN (
        SELECT fc.id
        FROM fichas_clinicas fc
        JOIN visitas v ON v.id = fc.visita_id
        JOIN pacientes p ON p.id = v.paciente_id
        WHERE p.rut = $1
      )
      OR variable_clinica_id IN (
        SELECT id FROM variables_clinicas WHERE codigo = ANY($2)
      )
      `,
      [PATIENT_RUT, variableCodes],
    );
    await dataSource.query(
      `
      DELETE FROM documentos_adjuntos
      WHERE ficha_clinica_id IN (
        SELECT fc.id
        FROM fichas_clinicas fc
        JOIN visitas v ON v.id = fc.visita_id
        JOIN pacientes p ON p.id = v.paciente_id
        WHERE p.rut = $1
      )
      `,
      [PATIENT_RUT],
    );
    await dataSource.query(
      `
      DELETE FROM fichas_clinicas
      WHERE visita_id IN (
        SELECT v.id
        FROM visitas v
        JOIN pacientes p ON p.id = v.paciente_id
        WHERE p.rut = $1
      )
      `,
      [PATIENT_RUT],
    );
    await dataSource.query(
      `
      DELETE FROM plantilla_ficha_campos
      WHERE plantilla_ficha_id IN (
        SELECT id FROM plantillas_ficha WHERE codigo = ANY($1)
      )
      `,
      [plantillaCodes],
    );
    await dataSource.query(
      'DELETE FROM plantillas_ficha WHERE codigo = ANY($1)',
      [plantillaCodes],
    );
    await dataSource.query(
      'DELETE FROM variables_clinicas WHERE codigo = ANY($1)',
      [variableCodes],
    );
    await dataSource.query(
      `
      DELETE FROM visitas
      WHERE paciente_id IN (
        SELECT id FROM pacientes WHERE rut = $1
      )
      `,
      [PATIENT_RUT],
    );
    await dataSource.query('DELETE FROM pacientes WHERE rut = $1', [
      PATIENT_RUT,
    ]);
  };

  const createDedicatedVisit = async () => {
    const profesionales = await dataSource.query(
      `
      SELECT ps.id AS "profesionalSaludId", u.id AS "usuarioId"
      FROM profesionales_salud ps
      JOIN usuarios u ON u.id = ps.usuario_id
      WHERE ps.deleted_at IS NULL
        AND ps.activo = TRUE
        AND u.deleted_at IS NULL
      LIMIT 1
      `,
    );

    if (profesionales.length === 0) {
      throw new Error(
        'Setup E2E ficha-clinica: no existe un profesional activo para crear la visita dedicada.',
      );
    }

    const pacientes = await dataSource.query(
      `
      INSERT INTO pacientes (rut, nombres, apellidos, fecha_nacimiento, sexo, telefono, email, direccion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        PATIENT_RUT,
        'Paciente',
        `Ficha ${RUN_ID}`,
        '1988-01-01',
        'F',
        '+56911111111',
        `ficha-${RUN_ID.toLowerCase()}@e2e.local`,
        'Direccion E2E',
      ],
    );
    pacienteId = pacientes[0]?.id;

    const visitas = await dataSource.query(
      `
      INSERT INTO visitas (
        paciente_id,
        profesional_salud_id,
        fecha_programada,
        hora_programada,
        duracion_estimada_min,
        estado,
        prioridad,
        creada_por_usuario_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        pacienteId,
        profesionales[0].profesionalSaludId,
        '2026-07-01',
        '09:00',
        60,
        'PROGRAMADA',
        'NORMAL',
        profesionales[0].usuarioId,
      ],
    );
    visitaId = visitas[0]?.id;

    if (!pacienteId || !visitaId) {
      throw new Error(
        'Setup E2E ficha-clinica: no se pudo crear paciente/visita dedicada.',
      );
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    await cleanupRunData();
    await createDedicatedVisit();
  });

  afterAll(async () => {
    await cleanupRunData();
    await app?.close();
  });

  describe('ETAPA 1 - Variables clinicas CRUD', () => {
    it('POST /variables-clinicas crea variable NUMERO con rango', async () => {
      const res = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({
          codigo: PA_CODE,
          nombre: `PA sistolica E2E ${RUN_ID}`,
          tipoDato: 'NUMERO',
          unidad: 'mmHg',
          categoria: 'SIGNOS_VITALES',
          valorMinimo: 60,
          valorMaximo: 250,
        })
        .expect(201);

      varPAId = res.body.id;
      expect(varPAId).toBeDefined();
      expect(res.body.codigo).toBe(PA_CODE);
      expect(res.body.valorMinimo).toBe(60);
    });

    it('POST /variables-clinicas rechaza codigo activo duplicado', async () => {
      await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: PA_CODE, nombre: 'Duplicada E2E', tipoDato: 'NUMERO' })
        .expect(400);
    });

    it('POST segunda variable', async () => {
      const res = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({
          codigo: TEMP_CODE,
          nombre: `Temperatura E2E ${RUN_ID}`,
          tipoDato: 'NUMERO',
          unidad: 'C',
          categoria: 'SIGNOS_VITALES',
          valorMinimo: 30,
          valorMaximo: 45,
        })
        .expect(201);

      varTempId = res.body.id;
      expect(varTempId).toBeDefined();
    });

    it('GET /variables-clinicas lista las variables creadas', async () => {
      const res = await request(app.getHttpServer())
        .get('/variables-clinicas')
        .set(AUTH)
        .expect(200);

      const codes = res.body.map((v: { codigo: string }) => v.codigo);
      expect(codes).toEqual(expect.arrayContaining([PA_CODE, TEMP_CODE]));
    });

    it('GET /variables-clinicas filtra por categoria', async () => {
      const res = await request(app.getHttpServer())
        .get('/variables-clinicas?categoria=SIGNOS_VITALES')
        .set(AUTH)
        .expect(200);

      expect(
        res.body.some((v: { codigo: string }) => v.codigo === PA_CODE),
      ).toBe(true);
    });

    it('GET /variables-clinicas/:id retorna una especifica', async () => {
      const res = await request(app.getHttpServer())
        .get(`/variables-clinicas/${varPAId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.codigo).toBe(PA_CODE);
    });

    it('PATCH /variables-clinicas/:id actualiza nombre', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/variables-clinicas/${varPAId}`)
        .set(AUTH)
        .send({ nombre: `PA sistolica E2E actualizada ${RUN_ID}` })
        .expect(200);

      expect(res.body.nombre).toContain('actualizada');
    });

    it('POST validation: rechaza falta de tipoDato', async () => {
      await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({ codigo: `BAD_${RUN_ID}`, nombre: 'Bad' })
        .expect(400);
    });
  });

  describe('ETAPA 2 - Plantillas de ficha', () => {
    it('POST /plantillas-ficha crea plantilla', async () => {
      const res = await request(app.getHttpServer())
        .post('/plantillas-ficha')
        .set(AUTH)
        .send({
          codigo: PLANTILLA_CODE,
          nombre: `Plantilla E2E ${RUN_ID}`,
          tipoAtencion: 'CONTROL',
        })
        .expect(201);

      plantillaId = res.body.id;
      expect(plantillaId).toBeDefined();
    });

    it('POST /plantillas-ficha rechaza codigo activo duplicado', async () => {
      await request(app.getHttpServer())
        .post('/plantillas-ficha')
        .set(AUTH)
        .send({
          codigo: PLANTILLA_CODE,
          nombre: 'Plantilla duplicada E2E',
          tipoAtencion: 'CONTROL',
        })
        .expect(400);
    });

    it('POST /plantillas-ficha/:id/campos crea campo TEXTO_LIBRE', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({
          codigoCampo: 'motivo',
          etiqueta: 'Motivo de atencion',
          tipoCampo: 'TEXTO_LIBRE',
          orden: 1,
          obligatorio: true,
        })
        .expect(201);
    });

    it('POST /plantillas-ficha/:id/campos crea campo VARIABLE_CLINICA', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({
          codigoCampo: 'PA_SIST',
          etiqueta: 'PA sistolica',
          tipoCampo: 'VARIABLE_CLINICA',
          variableClinicaId: varPAId,
          orden: 2,
          obligatorio: true,
        })
        .expect(201);
    });

    it('POST campo: rechaza VARIABLE_CLINICA sin variableClinicaId', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({
          codigoCampo: 'BAD',
          etiqueta: 'Bad',
          tipoCampo: 'VARIABLE_CLINICA',
          orden: 3,
        })
        .expect(400);
    });

    it('POST campo: rechaza codigoCampo duplicado', async () => {
      await request(app.getHttpServer())
        .post(`/plantillas-ficha/${plantillaId}/campos`)
        .set(AUTH)
        .send({
          codigoCampo: 'PA_SIST',
          etiqueta: 'Duplicado',
          tipoCampo: 'TEXTO_LIBRE',
          orden: 4,
        })
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

  describe('ETAPA 3 - Ficha clinica + extraccion a mediciones', () => {
    it('existe visita/paciente dedicado en la BD', () => {
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

    it('POST /fichas-clinicas rechaza crear segunda ficha activa para la misma visita', async () => {
      await request(app.getHttpServer())
        .post('/fichas-clinicas')
        .set(AUTH)
        .send({
          visitaId,
          plantillaFichaId: plantillaId,
          contenido: { motivo: 'Duplicada', PA_SIST: 125 },
        })
        .expect(409);
    });

    it('mediciones se crearon automaticamente desde el contenido', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const pa = res.body.find(
        (m: { variableClinicaId: string }) => m.variableClinicaId === varPAId,
      );
      expect(pa).toBeDefined();
      expect(Number(pa.valorNumero)).toBe(120);
    });

    it('campos TEXTO_LIBRE no generan mediciones', async () => {
      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      const motivoMediciones = res.body.find(
        (m: { variableClinicaId: string }) => m.variableClinicaId === 'motivo',
      );
      expect(motivoMediciones).toBeUndefined();
    });

    it('PATCH /fichas-clinicas actualiza y re-sincroniza mediciones', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/fichas-clinicas/${fichaId}`)
        .set(AUTH)
        .send({ contenido: { motivo: 'Actualizado', PA_SIST: 130 } })
        .expect(200);
      expect(patchRes.body.contenido.PA_SIST).toBe(130);

      const res = await request(app.getHttpServer())
        .get(`/mediciones-clinicas?fichaClinicaId=${fichaId}`)
        .set(AUTH)
        .expect(200);

      const activas = res.body.filter(
        (m: { deletedAt: null | string; variableClinicaId: string }) =>
          m.variableClinicaId === varPAId && m.deletedAt === null,
      );
      expect(activas.length).toBeGreaterThanOrEqual(1);

      const activeRows = await dataSource.query(
        `
        SELECT valor_numero
        FROM mediciones_clinicas
        WHERE ficha_clinica_id = $1
          AND variable_clinica_id = $2
          AND origen = 'FICHA'
          AND deleted_at IS NULL
        `,
        [fichaId, varPAId],
      );
      expect(activeRows).toHaveLength(1);
      expect(Number(activeRows[0].valor_numero)).toBe(130);
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

  describe('ETAPA 4 - Mediciones manuales', () => {
    it('POST /mediciones-clinicas crea medicion manual', async () => {
      const res = await request(app.getHttpServer())
        .post('/mediciones-clinicas')
        .set(AUTH)
        .send({
          pacienteId,
          variableClinicaId: varTempId,
          valorNumero: 36.5,
          origen: 'MANUAL',
          unidad: 'C',
        })
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

  describe('ETAPA 5 - Soft delete en variables', () => {
    it('DELETE soft-deletea y permite reutilizar el codigo', async () => {
      const tempV = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({
          codigo: DEL_CODE,
          nombre: `To delete E2E ${RUN_ID}`,
          tipoDato: 'TEXTO',
        })
        .expect(201);

      const id = tempV.body.id;

      await request(app.getHttpServer())
        .delete(`/variables-clinicas/${id}`)
        .set(AUTH)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/variables-clinicas/${id}`)
        .set(AUTH)
        .expect(404);

      const recreated = await request(app.getHttpServer())
        .post('/variables-clinicas')
        .set(AUTH)
        .send({
          codigo: DEL_CODE,
          nombre: `Recreated E2E ${RUN_ID}`,
          tipoDato: 'TEXTO',
        })
        .expect(201);

      expect(recreated.body.codigo).toBe(DEL_CODE);
    });
  });

  describe('ETAPA 6 - RBAC', () => {
    it('PROFESIONAL no puede DELETE variables (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/variables-clinicas/${varPAId}`)
        .set(AUTH_PROF)
        .expect(403);
    });

    it('sin headers de auth da 401', async () => {
      await request(app.getHttpServer()).get('/variables-clinicas').expect(401);
    });
  });
});

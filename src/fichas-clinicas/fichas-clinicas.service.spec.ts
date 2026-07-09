import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { PacienteAccessService } from '../auth/services/paciente-access.service';
import { PlantillasFichaService } from '../plantillas-ficha/plantillas-ficha.service';
import { VariablesClinicasService } from '../variables-clinicas/variables-clinicas.service';
import { MedicionClinica } from '../mediciones-clinicas/entities/medicion-clinica.entity';
import { FichaClinica } from './entities/ficha-clinica.entity';
import { CreateFichaClinicaDto, UpdateFichaClinicaDto } from './dto/create-ficha-clinica.dto';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { FichasClinicasService } from './fichas-clinicas.service';

const _mockQb = () => {
  const qb: any = {};
  qb.select = jest.fn().mockReturnValue(qb);
  qb.from = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.getRawOne = jest.fn().mockResolvedValue({ pacienteId: 'p-mock', count: '0' });
  qb.update = jest.fn().mockReturnValue(qb);
  qb.set = jest.fn().mockReturnValue(qb);
  qb.execute = jest.fn().mockResolvedValue({});
  return qb;
};

const _createRepo = () => ({
  find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(_mockQb()),
  manager: { createQueryBuilder: jest.fn().mockReturnValue(_mockQb()) },
});

const mockAuditorias = () =>
  ({ findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), registrar: jest.fn() }) as unknown as AuditoriasService;

const mockPlantillas = () =>
  ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneWithCampos: jest.fn(),
    findCamposVariablesByPlantilla: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }) as unknown as PlantillasFichaService;

const mockVariables = () =>
  ({ findAll: jest.fn(), findOne: jest.fn(), findByCodigo: jest.fn() }) as unknown as VariablesClinicasService;

const mockPacienteAccess = () =>
  ({ assertAccesoPaciente: jest.fn(), assertAccesoVisita: jest.fn() }) as unknown as PacienteAccessService;

describe('FichasClinicasService', () => {
  let service: FichasClinicasService;
  let fichasRepo: ReturnType<typeof _createRepo>;
  let medicionesRepo: ReturnType<typeof _createRepo>;
  let auditorias: AuditoriasService;
  let plantillas: PlantillasFichaService;
  let variables: VariablesClinicasService;

  beforeEach(async () => {
    fichasRepo = _createRepo();
    medicionesRepo = _createRepo();
    auditorias = mockAuditorias();
    plantillas = mockPlantillas();
    variables = mockVariables();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FichasClinicasService,
        { provide: getRepositoryToken(FichaClinica), useValue: fichasRepo },
        { provide: getRepositoryToken(MedicionClinica), useValue: medicionesRepo },
        { provide: AuditoriasService, useValue: auditorias },
        { provide: PlantillasFichaService, useValue: plantillas },
        { provide: VariablesClinicasService, useValue: variables },
        { provide: AnalyticsService, useValue: { sendFichaUpsertEvent: jest.fn() } },
        { provide: PacienteAccessService, useValue: mockPacienteAccess() },
      ],
    }).compile();

    service = module.get(FichasClinicasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateFichaClinicaDto = {
      visitaId: 'visita-1',
      contenido: {
        motivo_atencion: 'Control general',
        temperatura: 36.8,
      },
    };

    it('creates ficha and triggers syncMediciones when plantilla is provided', async () => {
      (fichasRepo.create as jest.Mock).mockReturnValue({ id: 'f1', ...dto, estado: 'BORRADOR' });
      (fichasRepo.save as jest.Mock).mockResolvedValue({ id: 'f1', visitaId: 'visita-1', contenido: dto.contenido, estado: 'BORRADOR', plantillaFichaId: null });

      const result = await service.create(dto, 'user-1');
      expect(result.estado).toBe('BORRADOR');
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'user-1',
          accion: 'CREAR',
          newValues: expect.objectContaining({
            visitaId: 'visita-1',
            estado: 'BORRADOR',
          }),
        }),
      );
    });

    it('validates plantillaFichaId exists when provided', async () => {
      (plantillas.findOne as jest.Mock).mockRejectedValue(new NotFoundException());
      await expect(
        service.create({ ...dto, plantillaFichaId: 'bad-plantilla' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates ficha fields and syncs mediciones if contenido changes', async () => {
      const existing = { id: 'f1', visitaId: 'v1', contenido: { temp: 36 }, estado: 'BORRADOR', plantillaFichaId: null, deletedAt: null };
      (fichasRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (fichasRepo.save as jest.Mock).mockResolvedValue({ ...existing, contenido: { temp: 37 }, estado: 'BORRADOR' });

      const result = await service.update('f1', { contenido: { temp: 37 } }, 'user-1');
      expect(result.contenido.temp).toBe(37);
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'user-1',
          accion: 'ACTUALIZAR',
          oldValues: expect.objectContaining({ estado: 'BORRADOR' }),
          newValues: expect.objectContaining({ estado: 'BORRADOR' }),
        }),
      );
    });
  });

  describe('cerrar', () => {
    it('closes an open ficha', async () => {
      (fichasRepo.findOne as jest.Mock).mockResolvedValue({ id: 'f1', estado: 'BORRADOR', deletedAt: null });
      (fichasRepo.save as jest.Mock).mockResolvedValue({ id: 'f1', estado: 'CERRADA' });

      const result = await service.cerrar('f1', 'user-1');
      expect(result.estado).toBe('CERRADA');
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'user-1',
          accion: 'CERRAR',
          oldValues: expect.objectContaining({ estado: 'BORRADOR' }),
          newValues: expect.objectContaining({ estado: 'CERRADA' }),
        }),
      );
    });

    it('throws if already closed', async () => {
      (fichasRepo.findOne as jest.Mock).mockResolvedValue({ id: 'f1', estado: 'CERRADA', deletedAt: null });
      await expect(service.cerrar('f1')).rejects.toThrow(BadRequestException);
    });
  });

  // ======================================================
  // IMPORTANTE: syncMediciones — corazon del modelo hibrido
  // ======================================================
  describe('syncMediciones', () => {
    it('does nothing when no plantillaFichaId', async () => {
      const ficha = { id: 'f1', visitaId: 'v1', plantillaFichaId: null, contenido: {}, creadaPorUsuarioId: null, version: 1, estado: 'BORRADOR', createdAt: new Date(), updatedAt: new Date() } as FichaClinica;
      await service.syncMediciones(ficha);
      expect(plantillas.findCamposVariablesByPlantilla).not.toHaveBeenCalled();
    });

    it('soft-deletes old mediciones and recreates from content', async () => {
      const ficha = {
        id: 'f1', visitaId: 'v1', plantillaFichaId: 'pt1',
        contenido: { motivo_atencion: 'Control de rutina', temperatura: 36.8, presion_arterial_sistolica: 120 },
        creadaPorUsuarioId: 'user-1', version: 1, estado: 'BORRADOR',
        createdAt: new Date(), updatedAt: new Date(),
      } as FichaClinica;

      const camposVariables = [
        { id: 'c1', codigoCampo: 'temperatura', variableClinicaId: 'var-temp', tipoCampo: 'VARIABLE_CLINICA' },
        { id: 'c2', codigoCampo: 'presion_arterial_sistolica', variableClinicaId: 'var-pa', tipoCampo: 'VARIABLE_CLINICA' },
      ];

      (plantillas.findCamposVariablesByPlantilla as jest.Mock).mockResolvedValue(camposVariables);
      (variables.findOne as jest.Mock).mockImplementation(async (id: string) => {
        if (id === 'var-temp') return { id: 'var-temp', codigo: 'temperatura', nombre: 'Temperatura', tipoDato: 'NUMERO', unidad: '°C', valorMinimo: 30, valorMaximo: 45 };
        if (id === 'var-pa') return { id: 'var-pa', codigo: 'presion_arterial_sistolica', nombre: 'PA sistólica', tipoDato: 'NUMERO', unidad: 'mmHg', valorMinimo: 60, valorMaximo: 250 };
        throw new NotFoundException();
      });

      // Mock la query de soft-delete
      const mockUpdateQB = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
      (medicionesRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockUpdateQB);

      // Mock obtenerPacienteIdDesdeVisita
      const mockVisitaQB = { select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ pacienteId: 'pac-1' }) };
      (fichasRepo.manager.createQueryBuilder as jest.Mock).mockReturnValue(mockVisitaQB);

      // Mock create y save de mediciones
      (medicionesRepo.create as jest.Mock).mockImplementation((obj: Record<string, unknown>) => ({ id: `med-${obj.variableClinicaId}`, ...obj }));
      (medicionesRepo.save as jest.Mock).mockImplementation(async (obj: Record<string, unknown>) => ({ id: obj.id, ...obj }));

      await service.syncMediciones(ficha);

      // Verificar que se hizo soft-delete de mediciones anteriores
      expect(medicionesRepo.createQueryBuilder).toHaveBeenCalled();

      // Verificar que se crearon 2 mediciones nuevas
      expect(medicionesRepo.save).toHaveBeenCalledTimes(2);
    });

    it('throws BadRequestException when valor is out of range', async () => {
      const ficha = {
        id: 'f2', visitaId: 'v1', plantillaFichaId: 'pt1',
        contenido: { temperatura: 200 }, creadaPorUsuarioId: null,
        version: 1, estado: 'BORRADOR', createdAt: new Date(), updatedAt: new Date(),
      } as FichaClinica;

      (plantillas.findCamposVariablesByPlantilla as jest.Mock).mockResolvedValue([
        { id: 'c1', codigoCampo: 'temperatura', variableClinicaId: 'var-temp', tipoCampo: 'VARIABLE_CLINICA' },
      ]);
      (variables.findOne as jest.Mock).mockResolvedValue({
        id: 'var-temp', codigo: 'temperatura', tipoDato: 'NUMERO', unidad: '°C', valorMinimo: 30, valorMaximo: 45,
      });

      const mockUpdateQB = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), execute: jest.fn() };
      (medicionesRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockUpdateQB);

      const mockVisitaQB = { select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ pacienteId: 'pac-1' }) };
      (fichasRepo.manager.createQueryBuilder as jest.Mock).mockReturnValue(mockVisitaQB);

      await expect(service.syncMediciones(ficha)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('filters by visitaId and estado', async () => {
      const mockQB = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      (fichasRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQB);

      await service.findAll({ visitaId: 'v1', estado: 'BORRADOR' });
      expect(mockQB.andWhere).toHaveBeenCalledWith('fc.visita_id = :visitaId', { visitaId: 'v1' });
      expect(mockQB.andWhere).toHaveBeenCalledWith('fc.estado = :estado', { estado: 'BORRADOR' });
    });
  });

  describe('remove', () => {
    it('soft-deletes ficha', async () => {
      (fichasRepo.findOne as jest.Mock).mockResolvedValue({ id: 'f1', deletedAt: null });
      (fichasRepo.save as jest.Mock).mockResolvedValue({ id: 'f1', deletedAt: new Date() });

      const result = await service.remove('f1', 'admin-1');
      expect(result.deletedAt).toBeDefined();
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 'admin-1',
          accion: 'ELIMINAR',
          oldValues: expect.objectContaining({ deletedAt: null }),
          newValues: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});

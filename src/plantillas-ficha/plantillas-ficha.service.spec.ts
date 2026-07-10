import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { VariablesClinicasService } from '../variables-clinicas/variables-clinicas.service';
import { PlantillaFicha } from './entities/plantilla-ficha.entity';
import { PlantillaFichaCampo } from './entities/plantilla-ficha-campo.entity';
import {
  CreatePlantillaFichaDto,
  UpdatePlantillaFichaDto,
} from './dto/create-plantilla-ficha.dto';
import {
  CreatePlantillaFichaCampoDto,
  UpdatePlantillaFichaCampoDto,
} from './dto/create-plantilla-ficha-campo.dto';
import { PlantillasFichaService } from './plantillas-ficha.service';

const _createRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
  exist: jest.fn(),
});

const mockAuditorias = () =>
  ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    registrar: jest.fn(),
  }) as unknown as AuditoriasService;

const mockVariables = () =>
  ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCodigo: jest.fn(),
  }) as unknown as VariablesClinicasService;

describe('PlantillasFichaService', () => {
  let service: PlantillasFichaService;
  let plantillasRepo: ReturnType<typeof _createRepo>;
  let camposRepo: ReturnType<typeof _createRepo>;
  let auditorias: AuditoriasService;
  let variables: VariablesClinicasService;

  beforeEach(async () => {
    plantillasRepo = _createRepo();
    camposRepo = _createRepo();
    auditorias = mockAuditorias();
    variables = mockVariables();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillasFichaService,
        {
          provide: getRepositoryToken(PlantillaFicha),
          useValue: plantillasRepo,
        },
        {
          provide: getRepositoryToken(PlantillaFichaCampo),
          useValue: camposRepo,
        },
        { provide: AuditoriasService, useValue: auditorias },
        { provide: VariablesClinicasService, useValue: variables },
      ],
    }).compile();

    service = module.get(PlantillasFichaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create plantilla', () => {
    it('creates a plantilla with defaults', async () => {
      const dto: CreatePlantillaFichaDto = { codigo: 'TEST', nombre: 'Test' };
      plantillasRepo.findOne.mockResolvedValue(null);
      plantillasRepo.create.mockReturnValue({
        id: '1',
        ...dto,
        activa: true,
      });
      plantillasRepo.save.mockResolvedValue({ id: '1', ...dto });

      const result = await service.create(dto);
      expect(result.codigo).toBe('TEST');
      expect(auditorias.registrar).toHaveBeenCalled();
    });

    it('rejects an active duplicate codigo with BadRequestException', async () => {
      const dto: CreatePlantillaFichaDto = {
        codigo: 'TEST',
        nombre: 'Test duplicada',
      };
      plantillasRepo.findOne.mockResolvedValue({
        id: 'existing',
        codigo: dto.codigo,
        deletedAt: null,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(plantillasRepo.save).not.toHaveBeenCalled();
    });

    it('allows reusing a codigo when no active row exists', async () => {
      const dto: CreatePlantillaFichaDto = {
        codigo: 'TEST',
        nombre: 'Test nueva',
      };
      plantillasRepo.findOne.mockResolvedValue(null);
      plantillasRepo.create.mockReturnValue({
        id: 'new-id',
        ...dto,
        activa: true,
      });
      plantillasRepo.save.mockResolvedValue({
        id: 'new-id',
        ...dto,
      });

      await expect(service.create(dto)).resolves.toEqual(
        expect.objectContaining({ id: 'new-id' }),
      );
      expect(plantillasRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ codigo: dto.codigo }),
        }),
      );
    });
  });

  describe('create campo', () => {
    const plantillaId = 'plantilla-uuid';
    const dtoCampo: CreatePlantillaFichaCampoDto & {
      plantillaFichaId: string;
    } = {
      plantillaFichaId: plantillaId,
      codigoCampo: 'temp',
      etiqueta: 'Temperatura',
      tipoCampo: 'VARIABLE_CLINICA',
      variableClinicaId: 'var-uuid',
    };

    it('rejects if VARIABLE_CLINICA without variableClinicaId', async () => {
      plantillasRepo.findOne.mockResolvedValue({
        id: plantillaId,
        deletedAt: null,
      });
      await expect(
        service.createCampo({ ...dtoCampo, variableClinicaId: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate codigoCampo in same plantilla', async () => {
      plantillasRepo.findOne.mockResolvedValue({
        id: plantillaId,
        deletedAt: null,
      });
      (variables.findOne as jest.Mock).mockResolvedValue({
        id: 'var-uuid',
        activa: true,
      });
      camposRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.createCampo(dtoCampo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates campo when valid', async () => {
      plantillasRepo.findOne.mockResolvedValue({
        id: plantillaId,
        deletedAt: null,
      });
      (variables.findOne as jest.Mock).mockResolvedValue({
        id: 'var-uuid',
        activa: true,
      });
      camposRepo.findOne.mockResolvedValue(null);
      camposRepo.create.mockReturnValue({
        id: 'c1',
        ...dtoCampo,
      });
      camposRepo.save.mockResolvedValue({
        id: 'c1',
        ...dtoCampo,
      });

      const result = await service.createCampo(dtoCampo);
      expect(result.id).toBe('c1');
    });
  });

  describe('findOneWithCampos', () => {
    it('returns plantilla with its campos', async () => {
      plantillasRepo.findOne.mockResolvedValue({
        id: '1',
        codigo: 'TEST',
        deletedAt: null,
      });
      camposRepo.find.mockResolvedValue([{ id: 'c1', codigoCampo: 'temp' }]);

      const result = await service.findOneWithCampos('1');
      expect(result.codigo).toBe('TEST');
      expect(result.campos).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('soft-deletes plantilla', async () => {
      plantillasRepo.findOne.mockResolvedValue({
        id: '1',
        codigo: 'TEST',
        deletedAt: null,
      });
      plantillasRepo.save.mockResolvedValue({
        id: '1',
        codigo: 'TEST',
        deletedAt: new Date(),
      });

      const result = await service.remove('1');
      expect(result.deletedAt).toBeDefined();
    });
  });
});

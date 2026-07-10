import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { MedicionClinica } from './entities/medicion-clinica.entity';
import { CreateMedicionClinicaDto } from './dto/create-medicion-clinica.dto';
import { MedicionesClinicasService } from './mediciones-clinicas.service';

const _createRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockAuditorias = () =>
  ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    registrar: jest.fn(),
  }) as unknown as AuditoriasService;

describe('MedicionesClinicasService', () => {
  let service: MedicionesClinicasService;
  let repo: ReturnType<typeof _createRepo>;
  let auditorias: AuditoriasService;

  beforeEach(async () => {
    repo = _createRepo();
    auditorias = mockAuditorias();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicionesClinicasService,
        { provide: getRepositoryToken(MedicionClinica), useValue: repo },
        { provide: AuditoriasService, useValue: auditorias },
      ],
    }).compile();

    service = module.get(MedicionesClinicasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll with filters', () => {
    it('applies pacienteId filter', async () => {
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQB);

      await service.findAll({ pacienteId: 'p1' });
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'mc.paciente_id = :pacienteId',
        { pacienteId: 'p1' },
      );
    });

    it('applies codigoVariable filter with join', async () => {
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQB);

      await service.findAll({ codigoVariable: 'PA' });
      expect(mockQB.innerJoin).toHaveBeenCalled();
      expect(mockQB.andWhere).toHaveBeenCalledWith('vc.codigo = :codigo', {
        codigo: 'PA',
      });
    });
  });

  describe('create', () => {
    it('creates medicion with MANUAL origin by default', async () => {
      const dto: CreateMedicionClinicaDto = {
        pacienteId: 'p1',
        variableClinicaId: 'v1',
        valorNumero: 120,
      };
      repo.create.mockReturnValue({
        id: '1',
        ...dto,
        origen: 'MANUAL',
      });
      repo.save.mockResolvedValue({
        id: '1',
        ...dto,
        origen: 'MANUAL',
      });

      const result = await service.create(dto, 'user-1');
      expect(result.origen).toBe('MANUAL');
      expect(auditorias.registrar).toHaveBeenCalled();
    });
  });

  describe('findByVisita / findByPaciente', () => {
    it('delegates to findAll with visitaId', async () => {
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQB);

      await service.findByVisita('v1');
      expect(mockQB.andWhere).toHaveBeenCalledWith('mc.visita_id = :visitaId', {
        visitaId: 'v1',
      });
    });

    it('delegates to findAll with pacienteId', async () => {
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(mockQB);

      await service.findByPaciente('p1');
      expect(mockQB.andWhere).toHaveBeenCalledWith(
        'mc.paciente_id = :pacienteId',
        { pacienteId: 'p1' },
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes medicion', async () => {
      repo.findOne.mockResolvedValue({
        id: '1',
        deletedAt: null,
      });
      repo.save.mockResolvedValue({
        id: '1',
        deletedAt: new Date(),
      });

      const result = await service.remove('1');
      expect(result.deletedAt).toBeDefined();
    });
  });
});

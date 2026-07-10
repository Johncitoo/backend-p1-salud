import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { VariableClinica } from './entities/variable-clinica.entity';
import {
  CreateVariableClinicaDto,
  UpdateVariableClinicaDto,
} from './dto/create-variable-clinica.dto';
import { VariablesClinicasService } from './variables-clinicas.service';

type MockRepo = Partial<
  Record<keyof ReturnType<typeof _createRepo>, jest.Mock>
>;

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

describe('VariablesClinicasService', () => {
  let service: VariablesClinicasService;
  let repo: MockRepo;
  let auditorias: AuditoriasService;

  beforeEach(async () => {
    repo = _createRepo();
    auditorias = mockAuditorias();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariablesClinicasService,
        { provide: getRepositoryToken(VariableClinica), useValue: repo },
        { provide: AuditoriasService, useValue: auditorias },
      ],
    }).compile();

    service = module.get(VariablesClinicasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns variables with default ordering', async () => {
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      (repo.createQueryBuilder as jest.Mock).mockReturnValue(mockQB);

      await service.findAll();
      expect(mockQB.where).toHaveBeenCalledWith('vc.deleted_at IS NULL');
      expect(mockQB.orderBy).toHaveBeenCalledWith('vc.nombre', 'ASC');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when variable not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns variable when found', async () => {
      const vc = { id: '1', codigo: 'PA', nombre: 'Presion' };
      (repo.findOne as jest.Mock).mockResolvedValue(vc);
      await expect(service.findOne('1')).resolves.toEqual(vc);
    });
  });

  describe('create', () => {
    it('creates variable with defaults', async () => {
      const dto: CreateVariableClinicaDto = {
        codigo: 'peso',
        nombre: 'Peso',
        tipoDato: 'NUMERO',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({
        id: '1',
        ...dto,
        activa: true,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        id: '1',
        ...dto,
        activa: true,
      });

      const result = await service.create(dto);
      expect(result.codigo).toBe('peso');
      expect(repo.save).toHaveBeenCalled();
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidad: 'variables_clinicas',
          accion: 'CREAR',
        }),
      );
    });

    it('rejects an active duplicate codigo with BadRequestException', async () => {
      const dto: CreateVariableClinicaDto = {
        codigo: 'peso',
        nombre: 'Peso',
        tipoDato: 'NUMERO',
      };
      (repo.findOne as jest.Mock).mockResolvedValue({
        id: 'existing',
        codigo: dto.codigo,
        deletedAt: null,
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows reusing a codigo when no active row exists', async () => {
      const dto: CreateVariableClinicaDto = {
        codigo: 'peso',
        nombre: 'Peso nueva',
        tipoDato: 'NUMERO',
      };
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.create as jest.Mock).mockReturnValue({
        id: 'new-id',
        ...dto,
        activa: true,
      });
      (repo.save as jest.Mock).mockResolvedValue({
        id: 'new-id',
        ...dto,
        activa: true,
      });

      await expect(service.create(dto)).resolves.toEqual(
        expect.objectContaining({ id: 'new-id' }),
      );
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ codigo: dto.codigo }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates variable fields', async () => {
      const existing = {
        id: '1',
        codigo: 'peso',
        nombre: 'Peso',
        tipoDato: 'NUMERO',
        deletedAt: null,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(existing);
      (repo.save as jest.Mock).mockResolvedValue({
        ...existing,
        nombre: 'Peso corporal',
      });

      const result = await service.update('1', { nombre: 'Peso corporal' });
      expect(result.nombre).toBe('Peso corporal');
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ACTUALIZAR' }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes variable', async () => {
      const existing = {
        id: '1',
        codigo: 'peso',
        nombre: 'Peso',
        deletedAt: null,
      };
      (repo.findOne as jest.Mock).mockResolvedValue(existing);
      (repo.save as jest.Mock).mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      });

      const result = await service.remove('1');
      expect(result.deletedAt).toBeDefined();
      expect(auditorias.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ELIMINAR' }),
      );
    });
  });

  describe('findByCodigo', () => {
    it('finds by codigo excluding deleted', async () => {
      const vc = { id: '1', codigo: 'PA' };
      (repo.findOne as jest.Mock).mockResolvedValue(vc);
      await expect(service.findByCodigo('PA')).resolves.toEqual(vc);
      expect(repo.findOne).toHaveBeenCalled();
      const callArgs = (repo.findOne as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.codigo).toBe('PA');
      expect(callArgs.where.deletedAt).toBeDefined();
    });
  });
});

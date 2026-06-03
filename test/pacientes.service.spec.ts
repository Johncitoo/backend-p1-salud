import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PacientesService } from '../src/pacientes/pacientes.service';
import { Paciente } from '../src/pacientes/entities/paciente.entity';
import { DireccionPaciente } from '../src/pacientes/entities/direccion-paciente.entity';
import { ContactoPaciente } from '../src/pacientes/entities/contacto-paciente.entity';
import { PlanCuidado } from '../src/pacientes/entities/plan-cuidado.entity';
import { Visita } from '../src/pacientes/entities/visita.entity';

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepo = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('PacientesService', () => {
  let service: PacientesService;
  let pacienteRepo: MockRepository;
  let dirRepo: MockRepository;
  let contactoRepo: MockRepository;
  let planRepo: MockRepository;
  let visitaRepo: MockRepository;

  beforeEach(async () => {
    pacienteRepo = createMockRepo();
    dirRepo = createMockRepo();
    contactoRepo = createMockRepo();
    planRepo = createMockRepo();
    visitaRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PacientesService,
        { provide: getRepositoryToken(Paciente), useValue: pacienteRepo },
        { provide: getRepositoryToken(DireccionPaciente), useValue: dirRepo },
        { provide: getRepositoryToken(ContactoPaciente), useValue: contactoRepo },
        { provide: getRepositoryToken(PlanCuidado), useValue: planRepo },
        { provide: getRepositoryToken(Visita), useValue: visitaRepo },
      ],
    }).compile();

    service = module.get<PacientesService>(PacientesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create/findOne/update/remove paciente', () => {
    it('creates a paciente', async () => {
      const dto = { nombres: 'Ana', apellidos: 'Lopez' };
      const created = { id: '1', ...dto };
      (pacienteRepo.create as jest.Mock).mockReturnValue(created);
      (pacienteRepo.save as jest.Mock).mockResolvedValue(created);

      const res = await service.create(dto as any);
      expect(pacienteRepo.create).toHaveBeenCalledWith(dto);
      expect(pacienteRepo.save).toHaveBeenCalledWith(created);
      expect(res).toEqual(created);
    });

    it('finds one paciente', async () => {
      const existing = { id: '1', nombres: 'Ana' };
      (pacienteRepo.findOne as jest.Mock).mockResolvedValue(existing);
      const res = await service.findOne('1');
      expect(pacienteRepo.findOne).toHaveBeenCalled();
      expect(res).toEqual(existing);
    });

    it('updates paciente', async () => {
      const existing = { id: '1', nombres: 'Ana' };
      (pacienteRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (pacienteRepo.save as jest.Mock).mockResolvedValue({ ...existing, apellidos: 'X' });
      const res = await service.update('1', { apellidos: 'X' } as any);
      expect(pacienteRepo.save).toHaveBeenCalled();
      expect(res.apellidos).toBe('X');
    });

    it('removes paciente (soft delete)', async () => {
      const existing = { id: '1', nombres: 'Ana' };
      (pacienteRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (pacienteRepo.save as jest.Mock).mockResolvedValue({ ...existing, deletedAt: new Date() });
      const res = await service.remove('1');
      expect(pacienteRepo.save).toHaveBeenCalled();
      expect(res.deletedAt).toBeDefined();
    });
  });

  describe('direcciones CRUD', () => {
    it('creates direccion', async () => {
      const dto = { pacienteId: '1', calle: 'C' };
      const created = { id: 'd1', ...dto };
      (dirRepo.create as jest.Mock).mockReturnValue(created);
      (dirRepo.save as jest.Mock).mockResolvedValue(created);
      const res = await service.createDireccion(dto as any);
      expect(dirRepo.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(created);
    });
  });

  describe('contactos/planes/visitas basic create', () => {
    it('creates contacto', async () => {
      const dto = { pacienteId: '1', nombre: 'Ana' };
      const created = { id: 'c1', ...dto };
      (contactoRepo.create as jest.Mock).mockReturnValue(created);
      (contactoRepo.save as jest.Mock).mockResolvedValue(created);
      const res = await service.createContacto(dto as any);
      expect(contactoRepo.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(created);
    });

    it('creates plan', async () => {
      const dto = { pacienteId: '1', objetivo: 'O' };
      const created = { id: 'p1', ...dto };
      (planRepo.create as jest.Mock).mockReturnValue(created);
      (planRepo.save as jest.Mock).mockResolvedValue(created);
      const res = await service.createPlan(dto as any);
      expect(planRepo.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(created);
    });

    it('creates visita', async () => {
      const dto = { pacienteId: '1', observacion: 'ok' };
      const created = { id: 'v1', ...dto };
      (visitaRepo.create as jest.Mock).mockReturnValue(created);
      (visitaRepo.save as jest.Mock).mockResolvedValue(created);
      const res = await service.createVisita(dto as any);
      expect(visitaRepo.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(created);
    });
  });
});

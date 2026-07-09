import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Visita } from '../../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../../profesionales/entities/profesional-salud.entity';
import type { UsuarioPerfil } from '../../usuarios/usuarios.service';
import { PacienteAccessService } from './paciente-access.service';

const _createRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  exist: jest.fn(),
});

const mockUser = (rol: string, id = 'usuario-1'): UsuarioPerfil => ({
  id,
  identityUserId: `identity-${id}`,
  nombres: 'Test',
  apellidos: 'User',
  email: 'test@example.com',
  rol,
  activo: true,
});

describe('PacienteAccessService', () => {
  let service: PacienteAccessService;
  let visitasRepo: ReturnType<typeof _createRepo>;
  let profesionalesRepo: ReturnType<typeof _createRepo>;

  beforeEach(async () => {
    visitasRepo = _createRepo();
    profesionalesRepo = _createRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PacienteAccessService,
        { provide: getRepositoryToken(Visita), useValue: visitasRepo },
        { provide: getRepositoryToken(ProfesionalSalud), useValue: profesionalesRepo },
      ],
    }).compile();

    service = module.get(PacienteAccessService);
  });

  describe('assertAccesoPaciente', () => {
    it('no bloquea si no hay usuario (llamadas internas/sistema)', async () => {
      await expect(service.assertAccesoPaciente(undefined, 'paciente-1')).resolves.toBeUndefined();
      expect(profesionalesRepo.findOne).not.toHaveBeenCalled();
    });

    it.each(['ADMIN', 'COORDINADOR', 'SUPERVISOR'])(
      'no bloquea a %s: conserva visibilidad total de supervisión',
      async (rol) => {
        await expect(service.assertAccesoPaciente(mockUser(rol), 'paciente-1')).resolves.toBeUndefined();
        expect(profesionalesRepo.findOne).not.toHaveBeenCalled();
        expect(visitasRepo.exist).not.toHaveBeenCalled();
      },
    );

    it('rechaza a un PROFESIONAL sin perfil de ProfesionalSalud asociado', async () => {
      profesionalesRepo.findOne.mockResolvedValue(null);

      await expect(service.assertAccesoPaciente(mockUser('PROFESIONAL'), 'paciente-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(visitasRepo.exist).not.toHaveBeenCalled();
    });

    it('rechaza a un PROFESIONAL sin ninguna visita asignada con ese paciente (el bug de IDOR original)', async () => {
      profesionalesRepo.findOne.mockResolvedValue({ id: 'prof-1' });
      visitasRepo.exist.mockResolvedValue(false);

      await expect(service.assertAccesoPaciente(mockUser('PROFESIONAL'), 'paciente-ajeno')).rejects.toThrow(
        ForbiddenException,
      );
      expect(visitasRepo.exist).toHaveBeenCalledWith({
        where: { pacienteId: 'paciente-ajeno', profesionalSaludId: 'prof-1', deletedAt: expect.anything() },
      });
    });

    it('permite a un PROFESIONAL con al menos una visita asignada con ese paciente', async () => {
      profesionalesRepo.findOne.mockResolvedValue({ id: 'prof-1' });
      visitasRepo.exist.mockResolvedValue(true);

      await expect(service.assertAccesoPaciente(mockUser('PROFESIONAL'), 'paciente-propio')).resolves.toBeUndefined();
    });
  });

  describe('assertAccesoVisita', () => {
    it('no bloquea a roles de supervisión sin consultar la visita', async () => {
      await expect(service.assertAccesoVisita(mockUser('ADMIN'), 'visita-1')).resolves.toBeUndefined();
      expect(visitasRepo.findOne).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la visita no existe', async () => {
      visitasRepo.findOne.mockResolvedValue(null);

      await expect(service.assertAccesoVisita(mockUser('PROFESIONAL'), 'visita-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resuelve el pacienteId de la visita y delega en assertAccesoPaciente', async () => {
      visitasRepo.findOne.mockResolvedValue({ id: 'visita-1', pacienteId: 'paciente-de-la-visita' });
      profesionalesRepo.findOne.mockResolvedValue({ id: 'prof-1' });
      visitasRepo.exist.mockResolvedValue(false);

      await expect(service.assertAccesoVisita(mockUser('PROFESIONAL'), 'visita-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(visitasRepo.exist).toHaveBeenCalledWith({
        where: { pacienteId: 'paciente-de-la-visita', profesionalSaludId: 'prof-1', deletedAt: expect.anything() },
      });
    });
  });
});

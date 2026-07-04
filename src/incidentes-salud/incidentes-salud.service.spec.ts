import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { IncidenteSalud } from './entities/incidente-salud.entity';
import { IncidentesSaludService } from './incidentes-salud.service';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CrmService } from '../integrations/crm/crm.service';
import { PacientesService } from '../pacientes/pacientes.service';

type MockRepository<T extends { id: string }> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const incidente: IncidenteSalud = {
  id: 'inc-1111', tipo: 'CAIDA_PACIENTE', severidad: 'ALTA', estado: 'ABIERTO',
  titulo: 'Caída durante visita', descripcion: 'Paciente se cayó', pacienteId: 'p-2222',
  visitaId: 'v-3333', alertaId: null, profesionalSaludId: 'prof-4444',
  responsableUsuarioId: null, origen: 'WEB', externalIncidentId: null, metadata: {},
  creadoPorUsuarioId: 'u-1111', resueltoPorUsuarioId: null, resueltoAt: null, cerradoAt: null,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
} as IncidenteSalud;

describe('IncidentesSaludService', () => {
  let service: IncidentesSaludService;
  let repository: MockRepository<IncidenteSalud>;

  beforeEach(async () => {
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentesSaludService,
        { provide: getRepositoryToken(IncidenteSalud), useValue: repository },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
        { 
          provide: CrmService, 
          useValue: { 
            buildPayloadFromIncidente: jest.fn().mockReturnValue({}), 
            crearTicket: jest.fn().mockResolvedValue({}) 
          } 
        },
        { 
          provide: PacientesService, 
          useValue: { 
            findOne: jest.fn().mockResolvedValue({ id: 'p-2222', nombres: 'Test' }) 
          } 
        },
      ],
    }).compile();
    service = module.get<IncidentesSaludService>(IncidentesSaludService);
  });

  it('findOne retorna el incidente si existe', async () => {
    repository.findOne!.mockResolvedValue(incidente);
    await expect(service.findOne('inc-1111')).resolves.toEqual(incidente);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'inc-1111', deletedAt: IsNull() } });
  });

  it('findOne lanza NotFoundException si no existe', async () => {
    repository.findOne!.mockResolvedValue(null);
    await expect(service.findOne('no')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create guarda con valores por defecto', async () => {
    const dto = { tipo: 'CAIDA', titulo: 'Test', pacienteId: 'p-2222' };
    repository.create!.mockReturnValue({ ...dto, severidad: 'MEDIA', estado: 'ABIERTO', origen: 'SISTEMA' });
    repository.save!.mockResolvedValue(incidente);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(incidente);
  });

  it('update modifica el incidente', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente });
    const updated = { ...incidente, estado: 'EN_REVISION' };
    repository.save!.mockResolvedValue(updated);
    const result = await service.update('inc-1111', { estado: 'EN_REVISION' } as any);
    expect(result.estado).toBe('EN_REVISION');
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente });
    repository.save!.mockImplementation(async (v) => v);
    const result = await service.remove('inc-1111');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

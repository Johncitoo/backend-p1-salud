import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull, Repository } from 'typeorm';
import { IncidenteSalud } from './entities/incidente-salud.entity';
import { IncidentesSaludService } from './incidentes-salud.service';
import { Visita } from '../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { CrmService } from '../integrations/crm/crm.service';
import { IncidentesService } from '../integrations/incidentes/incidentes.service';
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
  let incidentesServiceMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    repository = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), createQueryBuilder: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentesSaludService,
        { provide: getRepositoryToken(IncidenteSalud), useValue: repository },
        { provide: getRepositoryToken(Visita), useValue: {} },
        { provide: getRepositoryToken(ProfesionalSalud), useValue: {} },
        { provide: getRepositoryToken(Usuario), useValue: {} },
        { provide: AuditoriasService, useValue: { registrar: jest.fn() } },
        { provide: IncidentesService, useValue: { enviarIncidente: jest.fn().mockResolvedValue(true) } },
        { 
          provide: CrmService, 
          useValue: { 
            buildPayloadFromIncidente: jest.fn().mockReturnValue({}), 
            crearTicket: jest.fn().mockResolvedValue({ ticket: { id: 'crm-123' } }),
            extractTicketId: jest.fn((response) => response?.ticket?.id ?? null),
            consultarEstadoTicket: jest.fn().mockResolvedValue({
              id: 'crm-123',
              asunto: 'Ticket CRM',
              estado: 'abierto',
              prioridad: 'alta',
              resolucion: null,
              salud_ref: 'inc-1111',
              fecha_vencimiento_sla: '2026-07-05T10:00:00.000Z',
            }),
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
    incidentesServiceMock = module.get<IncidentesService>(IncidentesService);
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
    const savedMock = { ...incidente, severidad: 'MEDIA' };
    repository.create!.mockReturnValue({ ...dto, severidad: 'MEDIA', estado: 'ABIERTO', origen: 'SISTEMA' });
    repository.save!.mockResolvedValue(savedMock);
    await expect(service.create(dto as any, 'u-1111')).resolves.toEqual(savedMock);
    expect(incidentesServiceMock.enviarIncidente).not.toHaveBeenCalled();
  });

  it('create dispara enviarIncidente al Proyecto 11 si es ALTA o CRITICA', async () => {
    const dto = { tipo: 'CAIDA', titulo: 'Test grave', pacienteId: 'p-2222', severidad: 'CRITICA' };
    const incidenteCritico = { ...incidente, severidad: 'CRITICA' };
    repository.create!.mockReturnValue(incidenteCritico);
    repository.save!.mockResolvedValue(incidenteCritico);
    await service.create(dto as any, 'u-1111');
    expect(incidentesServiceMock.enviarIncidente).toHaveBeenCalledWith(incidenteCritico);
  });

  it('findCrmStatus consulta el estado externo si existe externalIncidentId', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente, externalIncidentId: 'crm-123' });

    const result = await service.findCrmStatus('inc-1111');

    expect(result).toMatchObject({
      id: 'crm-123',
      externalIncidentId: 'crm-123',
      saludRef: 'inc-1111',
      titulo: 'Ticket CRM',
      estado: 'abierto',
      severidad: 'alta',
      fechaVencimientoSla: '2026-07-05T10:00:00.000Z',
      sincronizado: true,
    });
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

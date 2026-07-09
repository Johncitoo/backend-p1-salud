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
  let crmServiceMock: any;

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
            debeEnviarTicket: jest.fn((inc: any) => ['WEB', 'APP'].includes((inc?.origen ?? '').toUpperCase())),
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
    crmServiceMock = module.get<CrmService>(CrmService);
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
  });

  it('create reporta TODO incidente MANUAL al Proyecto 11 forzado (sin importar la severidad)', async () => {
    const dto = { tipo: 'CAIDA', titulo: 'Test grave', pacienteId: 'p-2222', severidad: 'CRITICA', origen: 'WEB' };
    const incidenteCritico = { ...incidente, severidad: 'CRITICA', origen: 'WEB' };
    repository.create!.mockReturnValue(incidenteCritico);
    repository.save!.mockResolvedValue(incidenteCritico);
    await service.create(dto as any, 'u-1111');
    expect(incidentesServiceMock.enviarIncidente).toHaveBeenCalledWith(incidenteCritico, { forzar: true });
  });

  it('create también reporta a Proyecto 11 los incidentes MANUALES de baja severidad (forzado)', async () => {
    const dto = { tipo: 'FALLA_DISPOSITIVO', titulo: 'Batería baja', pacienteId: 'p-2222', severidad: 'BAJA', origen: 'WEB' };
    const incidenteBajo = { ...incidente, severidad: 'BAJA', tipo: 'FALLA_DISPOSITIVO', origen: 'WEB' };
    repository.create!.mockReturnValue(incidenteBajo);
    repository.save!.mockResolvedValue(incidenteBajo);
    await service.create(dto as any, 'u-1111');
    expect(incidentesServiceMock.enviarIncidente).toHaveBeenCalledWith(incidenteBajo, { forzar: true });
  });

  it('crea ticket en CRM para incidentes MANUALES (origen WEB)', async () => {
    const dto = { tipo: 'CAIDA_PACIENTE', titulo: 'Caída', pacienteId: 'p-2222', origen: 'WEB' };
    const incidenteManual = { ...incidente, origen: 'WEB' };
    repository.create!.mockReturnValue(incidenteManual);
    repository.save!.mockResolvedValue(incidenteManual);
    await service.create(dto as any, 'u-1111');
    await new Promise((r) => setImmediate(r)); // deja resolver la promesa de CRM
    expect(crmServiceMock.crearTicket).toHaveBeenCalled();
  });

  it('NO crea ticket en CRM para incidentes automáticos del sistema (origen SISTEMA)', async () => {
    const dto = { tipo: 'FALLA_DISPOSITIVO', titulo: 'Batería baja', pacienteId: 'p-2222', origen: 'SISTEMA' };
    const incidenteSistema = { ...incidente, origen: 'SISTEMA', tipo: 'FALLA_DISPOSITIVO' };
    repository.create!.mockReturnValue(incidenteSistema);
    repository.save!.mockResolvedValue(incidenteSistema);
    await service.create(dto as any, 'u-1111');
    await new Promise((r) => setImmediate(r));
    expect(crmServiceMock.crearTicket).not.toHaveBeenCalled();
    // Pero sí se escala a Grupo 11 (incidentes operacionales), SIN forzar: el
    // filtro por eventType decide si se envía (solo los VISITA_* del catálogo).
    expect(incidentesServiceMock.enviarIncidente).toHaveBeenCalledWith(incidenteSistema, { forzar: false });
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

  it('update que CAMBIA el estado re-envía a Proyecto 11 (para cerrar/actualizar el ticket)', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente, estado: 'ABIERTO' });
    const resuelto = { ...incidente, estado: 'RESUELTO' };
    repository.save!.mockResolvedValue(resuelto);
    await service.update('inc-1111', { estado: 'RESUELTO' } as any);
    expect(incidentesServiceMock.enviarIncidente).toHaveBeenCalledWith(resuelto);
  });

  it('update que NO cambia el estado no re-envía a Proyecto 11', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente, estado: 'ABIERTO' });
    const soloTitulo = { ...incidente, estado: 'ABIERTO', titulo: 'Nuevo título' };
    repository.save!.mockResolvedValue(soloTitulo);
    await service.update('inc-1111', { titulo: 'Nuevo título' } as any);
    expect(incidentesServiceMock.enviarIncidente).not.toHaveBeenCalled();
  });

  it('remove marca deletedAt', async () => {
    repository.findOne!.mockResolvedValue({ ...incidente });
    repository.save!.mockImplementation(async (v) => v);
    const result = await service.remove('inc-1111');
    expect(result.deletedAt).toBeInstanceOf(Date);
  });
});

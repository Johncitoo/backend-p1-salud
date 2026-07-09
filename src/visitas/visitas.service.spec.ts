import { BadRequestException } from '@nestjs/common';
import { VisitasService } from './visitas.service';
import { Visita } from '../pacientes/entities/visita.entity';

const ids = {
  visita: '11111111-1111-4111-8111-111111111111',
  paciente: '22222222-2222-4222-8222-222222222222',
  profesional: '33333333-3333-4333-8333-333333333333',
  profesionalNuevo: '44444444-4444-4444-8444-444444444444',
  zona: '55555555-5555-4555-8555-555555555555',
  usuario: '66666666-6666-4666-8666-666666666666',
  usuarioProfesional: '77777777-7777-4777-8777-777777777777',
};

const baseVisita = (): Visita => ({
  id: ids.visita,
  pacienteId: ids.paciente,
  profesionalSaludId: ids.profesional,
  zonaId: ids.zona,
  fechaProgramada: '2026-07-01',
  horaProgramada: '09:00:00',
  duracionEstimadaMin: 60,
  estado: 'PROGRAMADA',
  prioridad: 'NORMAL',
  creadaPorUsuarioId: ids.usuario,
  googleCalendarSyncStatus: 'PENDING',
  googleCalendarSyncAttempts: 0,
  version: 1,
  createdAt: new Date('2026-07-01T12:00:00Z'),
  updatedAt: new Date('2026-07-01T12:00:00Z'),
  deletedAt: null,
} as Visita);

// Genera fecha/hora programada relativas a "ahora" para probar cancelación tardía.
const programadaDesdeAhora = (minutos: number) => {
  const d = new Date(Date.now() + minutos * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    fechaProgramada: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    horaProgramada: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
};

const paciente = {
  id: ids.paciente,
  rut: '12.345.678-9',
  nombres: 'Maria',
  apellidos: 'Rojas',
  email: 'maria@test.cl',
  telefono: '+56911111111',
};

const profesional = {
  id: ids.profesional,
  usuarioId: ids.usuarioProfesional,
  profesion: 'ENFERMERIA',
  activo: true,
};

const profesionalNuevo = {
  id: ids.profesionalNuevo,
  usuarioId: ids.usuarioProfesional,
  profesion: 'KINESIOLOGIA',
  activo: true,
};

const usuarioProfesional = {
  id: ids.usuarioProfesional,
  nombres: 'Ana',
  apellidos: 'Profesional',
  email: 'ana@test.cl',
};

const creador = {
  id: ids.usuario,
  nombres: 'Claudia',
  apellidos: 'Coordinadora',
  email: 'coord@test.cl',
};

const makeQueryBuilder = (result: { one?: unknown; raw?: unknown[]; many?: unknown[] } = {}) => {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['leftJoin', 'select', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'from']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn(async () => result.one ?? null);
  qb.getRawMany = jest.fn(async () => result.raw ?? []);
  qb.getMany = jest.fn(async () => result.many ?? []);
  return qb;
};

const makeRepo = <T extends object>() => ({
  find: jest.fn(),
  findOne: jest.fn(),
  exist: jest.fn(async () => true),
  create: jest.fn((value: Partial<T>) => value),
  save: jest.fn(async (value: T) => value),
  createQueryBuilder: jest.fn(() => makeQueryBuilder()),
});

describe('VisitasService calendar flows', () => {
  let service: VisitasService;
  let visitasRepo: ReturnType<typeof makeRepo<Visita>>;
  let pacientesRepo: ReturnType<typeof makeRepo<any>>;
  let profesionalesRepo: ReturnType<typeof makeRepo<any>>;
  let zonasRepo: ReturnType<typeof makeRepo<any>>;
  let planesRepo: ReturnType<typeof makeRepo<any>>;
  let direccionesRepo: ReturnType<typeof makeRepo<any>>;
  let usuariosRepo: ReturnType<typeof makeRepo<any>>;
  let reprogramacionesRepo: ReturnType<typeof makeRepo<any>>;
  let bloqueosRepo: ReturnType<typeof makeRepo<any>>;
  let estadoHistorialRepo: ReturnType<typeof makeRepo<any>>;
  let visitaPrestacionesRepo: ReturnType<typeof makeRepo<any>>;
  let motivosCancelacionRepo: ReturnType<typeof makeRepo<any>>;
  let motivosReprogramacionRepo: ReturnType<typeof makeRepo<any>>;
  let auditoriasService: { registrar: jest.Mock };
  let googleCalendarSyncService: Record<string, jest.Mock>;
  let analyticsService: Record<string, jest.Mock>;
  let notificacionesService: Record<string, jest.Mock>;
  let incidentesSaludService: { create: jest.Mock };

  const wireDefaults = () => {
    visitasRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder());
    bloqueosRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder());
    visitaPrestacionesRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder());

    pacientesRepo.findOne.mockResolvedValue(paciente);
    profesionalesRepo.findOne.mockImplementation(async ({ where }: any = {}) => {
      if (where?.id === ids.profesionalNuevo) return profesionalNuevo;
      if (where?.usuarioId) return profesional;
      return profesional;
    });
    usuariosRepo.findOne.mockImplementation(async ({ where }: any = {}) => {
      if (where?.id === ids.usuarioProfesional) return usuarioProfesional;
      return creador;
    });
    zonasRepo.findOne.mockResolvedValue({ id: ids.zona, nombre: 'Zona Norte' });
  };

  beforeEach(() => {
    visitasRepo = makeRepo<Visita>();
    pacientesRepo = makeRepo();
    profesionalesRepo = makeRepo();
    zonasRepo = makeRepo();
    planesRepo = makeRepo();
    direccionesRepo = makeRepo();
    usuariosRepo = makeRepo();
    reprogramacionesRepo = makeRepo();
    bloqueosRepo = makeRepo();
    estadoHistorialRepo = makeRepo();
    visitaPrestacionesRepo = makeRepo();
    motivosCancelacionRepo = makeRepo();
    motivosReprogramacionRepo = makeRepo();
    auditoriasService = { registrar: jest.fn() };
    googleCalendarSyncService = {
      syncCreatedVisit: jest.fn(async (visita) => visita),
      syncUpdatedVisit: jest.fn(async (visita) => visita),
      syncCanceledVisit: jest.fn(async (visita) => visita),
      syncVisitNow: jest.fn(async (visita) => visita),
      findLogsForVisit: jest.fn(async () => []),
      retryPendingVisits: jest.fn(async () => ({ attempted: 1, synced: 1, failed: 0 })),
    };
    analyticsService = {
      sendUsuarioUpsertEvent: jest.fn(),
      sendPacienteUpsertEvent: jest.fn(),
      sendProfesionalUpsertEvent: jest.fn(),
      sendZonaUpsertEvent: jest.fn(),
      sendVisitUpsertEvent: jest.fn(),
      sendVisitaInicioEvent: jest.fn(),
      sendVisitaFinEvent: jest.fn(),
    };
    notificacionesService = {
      notificarVisitaAgendada: jest.fn(),
      notificarVisitaCancelada: jest.fn(),
      notificarVisitaReprogramada: jest.fn(),
    };
    incidentesSaludService = { create: jest.fn() };

    wireDefaults();

    service = new VisitasService(
      visitasRepo as any,
      pacientesRepo as any,
      profesionalesRepo as any,
      zonasRepo as any,
      planesRepo as any,
      direccionesRepo as any,
      usuariosRepo as any,
      reprogramacionesRepo as any,
      bloqueosRepo as any,
      estadoHistorialRepo as any,
      visitaPrestacionesRepo as any,
      motivosCancelacionRepo as any,
      motivosReprogramacionRepo as any,
      auditoriasService as any,
      googleCalendarSyncService as any,
      analyticsService as any,
      notificacionesService as any,
      incidentesSaludService as any,
    );
  });

  it('crea visita, sincroniza Google Calendar, analitica, historial y notifica a paciente/profesional', async () => {
    const saved = baseVisita();
    visitasRepo.create.mockReturnValue(saved);
    visitasRepo.save.mockResolvedValue(saved);

    await expect(service.create({
      pacienteId: ids.paciente,
      profesionalSaludId: ids.profesional,
      zonaId: ids.zona,
      fechaProgramada: '2026-07-01',
      horaProgramada: '09:00',
      duracionEstimadaMin: 60,
      prioridad: 'NORMAL',
    }, ids.usuario)).resolves.toEqual(saved);

    expect(googleCalendarSyncService.syncCreatedVisit).toHaveBeenCalledWith(saved);
    expect(analyticsService.sendPacienteUpsertEvent).toHaveBeenCalledWith(paciente);
    expect(analyticsService.sendProfesionalUpsertEvent).toHaveBeenCalledWith(profesional, expect.objectContaining({ nombres: 'Ana' }));
    expect(analyticsService.sendVisitUpsertEvent).toHaveBeenCalledWith(saved, { visitType: 'ENFERMERIA' });
    expect(notificacionesService.notificarVisitaAgendada).toHaveBeenCalledWith(saved, paciente, usuarioProfesional);
    expect(estadoHistorialRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      visitaId: saved.id,
      estadoAnterior: null,
      estadoNuevo: 'PROGRAMADA',
      motivo: 'Visita creada',
    }));
  });

  it('bloquea creación cuando el profesional ya tiene una visita traslapada', async () => {
    visitasRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder({ one: baseVisita() }));

    await expect(service.create({
      pacienteId: ids.paciente,
      profesionalSaludId: ids.profesional,
      fechaProgramada: '2026-07-01',
      horaProgramada: '09:30',
      duracionEstimadaMin: 30,
    }, ids.usuario)).rejects.toBeInstanceOf(BadRequestException);

    expect(visitasRepo.save).not.toHaveBeenCalled();
    expect(googleCalendarSyncService.syncCreatedVisit).not.toHaveBeenCalled();
  });

  it('bloquea creación cuando existe bloqueo activo de agenda', async () => {
    visitasRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder());
    bloqueosRepo.createQueryBuilder.mockReturnValue(makeQueryBuilder({ one: { id: 'bloqueo-1' } }));

    await expect(service.create({
      pacienteId: ids.paciente,
      profesionalSaludId: ids.profesional,
      zonaId: ids.zona,
      fechaProgramada: '2026-07-01',
      horaProgramada: '10:00',
      duracionEstimadaMin: 45,
    }, ids.usuario)).rejects.toBeInstanceOf(BadRequestException);

    expect(visitasRepo.save).not.toHaveBeenCalled();
  });

  it('reprograma desde update, registra reprogramacion y notifica sin cambiar estado visible', async () => {
    const previous = baseVisita();
    const updated = { ...previous, fechaProgramada: '2026-07-02', horaProgramada: '11:30:00' } as Visita;
    visitasRepo.findOne.mockResolvedValue({ ...previous });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await expect(service.update(previous.id, {
      fechaProgramada: '2026-07-02',
      horaProgramada: '11:30',
    }, ids.usuario)).resolves.toEqual(expect.objectContaining({
      id: previous.id,
      fechaProgramada: updated.fechaProgramada,
      horaProgramada: '11:30',
      estado: 'PROGRAMADA',
    }));

    expect(auditoriasService.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REPROGRAMAR' }));
    expect(reprogramacionesRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      visitaId: previous.id,
      fechaProgramadaAnterior: '2026-07-01',
      horaProgramadaAnterior: '09:00:00',
      fechaProgramadaNueva: '2026-07-02',
      horaProgramadaNueva: '11:30:00',
    }));
    expect(googleCalendarSyncService.syncUpdatedVisit).toHaveBeenCalledWith(expect.objectContaining({ id: previous.id }), ids.profesional);
    expect(notificacionesService.notificarVisitaReprogramada).toHaveBeenCalledWith(expect.objectContaining({ id: previous.id }), paciente, usuarioProfesional);
  });

  it('actualiza estado sin registrar reprogramacion y deja historial de estado', async () => {
    const previous = baseVisita();
    visitasRepo.findOne.mockResolvedValue({ ...previous });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await service.update(previous.id, { estado: 'EN_CAMINO' }, ids.usuario);

    expect(auditoriasService.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ACTUALIZAR' }));
    expect(reprogramacionesRepo.save).not.toHaveBeenCalled();
    expect(estadoHistorialRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      estadoAnterior: 'PROGRAMADA',
      estadoNuevo: 'EN_CAMINO',
    }));
    expect(notificacionesService.notificarVisitaReprogramada).not.toHaveBeenCalled();
  });

  it('cancela visita y dispara Google Calendar, analitica, historial y notificaciones', async () => {
    const visita = baseVisita();
    visitasRepo.findOne.mockResolvedValue({ ...visita });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    const saved = await service.cancelar(visita.id, { observacionCancelacion: 'Paciente no disponible' }, ids.usuario);

    expect(saved.estado).toBe('CANCELADA');
    expect(saved.canceladaPorUsuarioId).toBe(ids.usuario);
    expect(googleCalendarSyncService.syncCanceledVisit).toHaveBeenCalledWith(expect.objectContaining({ estado: 'CANCELADA' }));
    expect(analyticsService.sendVisitUpsertEvent).toHaveBeenCalledWith(expect.objectContaining({ estado: 'CANCELADA' }), { visitType: 'ENFERMERIA' });
    expect(notificacionesService.notificarVisitaCancelada).toHaveBeenCalledWith(expect.objectContaining({ id: visita.id }), paciente, usuarioProfesional, 'Paciente no disponible');
    expect(estadoHistorialRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      estadoAnterior: 'PROGRAMADA',
      estadoNuevo: 'CANCELADA',
      observacion: 'Paciente no disponible',
    }));
  });

  it('cancelación tardía muy cercana (<1h) genera incidente ALTA VISITA_CANCELADA_TARDIA', async () => {
    const visita = { ...baseVisita(), ...programadaDesdeAhora(30) } as Visita;
    visitasRepo.findOne.mockResolvedValue({ ...visita });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await service.cancelar(visita.id, { observacionCancelacion: 'Imprevisto' }, ids.usuario);

    expect(incidentesSaludService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'VISITA_CANCELADA_TARDIA',
        severidad: 'ALTA',
        origen: 'SISTEMA',
        pacienteId: visita.pacienteId,
        visitaId: visita.id,
        profesionalSaludId: visita.profesionalSaludId,
      }),
      ids.usuario,
    );
  });

  it('cancelación tardía moderada (1-2h) genera incidente MEDIA', async () => {
    const visita = { ...baseVisita(), ...programadaDesdeAhora(90) } as Visita;
    visitasRepo.findOne.mockResolvedValue({ ...visita });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await service.cancelar(visita.id, {}, ids.usuario);

    expect(incidentesSaludService.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'VISITA_CANCELADA_TARDIA', severidad: 'MEDIA' }),
      ids.usuario,
    );
  });

  it('cancelación con suficiente anticipación (>2h) NO genera incidente', async () => {
    const visita = { ...baseVisita(), ...programadaDesdeAhora(180) } as Visita;
    visitasRepo.findOne.mockResolvedValue({ ...visita });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await service.cancelar(visita.id, {}, ids.usuario);

    expect(incidentesSaludService.create).not.toHaveBeenCalled();
  });

  it('marca inicio y fin reales en cambios de estado y envia eventos de ciclo de vida a analitica', async () => {
    const visita = baseVisita();
    visitasRepo.findOne.mockResolvedValue({ ...visita });
    visitasRepo.save.mockImplementation(async (value) => ({ ...value }));

    await service.cambiarEstado(visita.id, { estado: 'EN_ATENCION' }, ids.usuario);
    expect(analyticsService.sendVisitaInicioEvent).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'EN_ATENCION',
      fechaHoraInicioReal: expect.any(Date),
    }));

    visitasRepo.findOne.mockResolvedValue({ ...visita, estado: 'EN_ATENCION', fechaHoraInicioReal: new Date() });
    await service.completar(visita.id, { puntual: true }, ids.usuario);
    expect(analyticsService.sendVisitaFinEvent).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'REALIZADA',
      fechaHoraFinReal: expect.any(Date),
    }), { puntual: true });
  });

  it('rechaza estados inválidos antes de persistir', async () => {
    visitasRepo.findOne.mockResolvedValue(baseVisita());

    await expect(service.cambiarEstado(ids.visita, { estado: 'ROMPIDA' } as any, ids.usuario))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(visitasRepo.save).not.toHaveBeenCalled();
    expect(analyticsService.sendVisitUpsertEvent).not.toHaveBeenCalled();
  });

  it('devuelve calendario filtrado para profesional con campos enriquecidos y prestaciones', async () => {
    profesionalesRepo.findOne.mockResolvedValueOnce(profesional);
    const calendarQb = makeQueryBuilder({
      raw: [{
        id: ids.visita,
        estado: 'PROGRAMADA',
        prioridad: 'NORMAL',
        fechaProgramada: new Date('2026-07-01T00:00:00Z'),
        horaProgramada: '09:00:00',
        duracionEstimadaMin: 60,
        pacienteId: ids.paciente,
        pacienteNombres: 'Maria',
        pacienteApellidos: 'Rojas',
        pacienteRut: '12.345.678-9',
        pacienteTelefono: '+56911111111',
        pacienteDireccion: 'Av Salud 123',
        profesionalSaludId: ids.profesional,
        profesionalNombres: 'Ana',
        profesionalApellidos: 'Profesional',
        profesionalProfesion: 'ENFERMERIA',
        zonaId: ids.zona,
        zonaNombre: 'Zona Norte',
        direccionDetallada: 'Los Robles 45, Santiago',
        googleCalendarSyncStatus: 'SYNCED',
      }],
    });
    const prestacionesQb = makeQueryBuilder({
      raw: [{
        visitaId: ids.visita,
        prestacionId: '88888888-8888-4888-8888-888888888888',
        cantidad: 1,
        estado: 'PROGRAMADA',
        codigo: 'CONTROL',
        nombre: 'Control de signos vitales',
        duracionEstimadaMin: 20,
      }],
    });
    visitasRepo.createQueryBuilder.mockReturnValue(calendarQb);
    visitaPrestacionesRepo.createQueryBuilder.mockReturnValue(prestacionesQb);

    const rows = await service.findCalendarForUser(
      { desde: '2026-07-01', hasta: '2026-07-31' },
      { id: ids.usuarioProfesional, rol: 'PROFESIONAL' } as any,
    );

    expect(calendarQb.andWhere).toHaveBeenCalledWith('visita.profesional_salud_id = :profesionalId', { profesionalId: ids.profesional });
    expect(rows).toEqual([expect.objectContaining({
      id: ids.visita,
      fechaProgramada: '2026-07-01',
      startsAt: '2026-07-01T09:00:00',
      endsAt: '2026-07-01T10:00:00',
      direccion: 'Los Robles 45, Santiago',
      prestaciones: [expect.objectContaining({ nombre: 'Control de signos vitales', cantidad: 1 })],
    })]);
  });
});

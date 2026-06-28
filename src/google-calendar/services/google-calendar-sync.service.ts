import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Visita } from '../../pacientes/entities/visita.entity';
import { GoogleCalendarSyncLog } from '../entities/google-calendar-sync-log.entity';
import { ProfesionalGoogleCalendarConnection } from '../entities/profesional-google-calendar-connection.entity';
import { GoogleCalendarClientService, GoogleCalendarEventPayload, GoogleTokenResponse } from './google-calendar-client.service';
import { GoogleTokenEncryptionService } from './google-token-encryption.service';

type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
type VisitCalendarContext = {
  pacienteNombre?: string | null;
  pacienteTelefono?: string | null;
  direccion?: string | null;
  zonaNombre?: string | null;
  profesionalNombre?: string | null;
};

@Injectable()
export class GoogleCalendarSyncService implements OnModuleInit, OnModuleDestroy {
  private retryTimer?: NodeJS.Timeout;
  private retryRunning = false;

  constructor(
    @InjectRepository(ProfesionalGoogleCalendarConnection)
    private readonly connectionsRepo: Repository<ProfesionalGoogleCalendarConnection>,
    @InjectRepository(GoogleCalendarSyncLog)
    private readonly logsRepo: Repository<GoogleCalendarSyncLog>,
    @InjectRepository(Visita)
    private readonly visitasRepo: Repository<Visita>,
    private readonly googleClient: GoogleCalendarClientService,
    private readonly tokenEncryption: GoogleTokenEncryptionService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (this.configService.get<string>('GOOGLE_CALENDAR_AUTO_RETRY_ENABLED') !== 'true') return;

    const intervalMs = Number(this.configService.get<string>('GOOGLE_CALENDAR_AUTO_RETRY_INTERVAL_MS') ?? 300000);
    this.retryTimer = setInterval(() => {
      void this.retryPendingVisits().catch(() => undefined);
    }, Math.max(intervalMs, 60000));
  }

  onModuleDestroy() {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  async syncCreatedVisit(visita: Visita): Promise<void> {
    await this.syncVisit(visita, 'CREATE');
  }

  async syncUpdatedVisit(visita: Visita, previousProfesionalSaludId?: string): Promise<void> {
    if (previousProfesionalSaludId && previousProfesionalSaludId !== visita.profesionalSaludId && visita.googleCalendarEventId) {
      await this.deleteExistingEvent(visita);
      visita.googleCalendarEventId = null;
      visita.googleCalendarConnectionId = null;
    }

    await this.syncVisit(visita, visita.googleCalendarEventId ? 'UPDATE' : 'CREATE');
  }

  async syncCanceledVisit(visita: Visita): Promise<void> {
    if (!visita.googleCalendarEventId) return;
    await this.syncVisit(visita, 'DELETE');
  }

  async syncVisitNow(visita: Visita): Promise<Visita> {
    if (visita.estado === 'CANCELADA' || visita.deletedAt) {
      if (!visita.googleCalendarEventId) return visita;
      return this.syncVisit(visita, 'DELETE');
    }

    return this.syncVisit(visita, visita.googleCalendarEventId ? 'UPDATE' : 'CREATE');
  }

  async findLogsForVisit(visitaId: string): Promise<GoogleCalendarSyncLog[]> {
    return this.logsRepo.find({
      where: { visitaId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async retryPendingVisits(limit = 20): Promise<{ attempted: number; synced: number; failed: number }> {
    if (this.retryRunning) return { attempted: 0, synced: 0, failed: 0 };
    this.retryRunning = true;

    try {
      const visits = await this.visitasRepo
        .createQueryBuilder('visita')
        .where('visita.deleted_at IS NULL')
        .andWhere('visita.google_calendar_sync_status IN (:...statuses)', { statuses: ['FAILED', 'PENDING'] })
        .orderBy('visita.google_calendar_last_sync_at', 'ASC', 'NULLS FIRST')
        .take(limit)
        .getMany();

      let synced = 0;
      let failed = 0;

      for (const visit of visits) {
        const result = await this.syncVisitNow(visit);
        if (result.googleCalendarSyncStatus === 'SYNCED' || result.googleCalendarSyncStatus === 'DELETED') synced += 1;
        if (result.googleCalendarSyncStatus === 'FAILED') failed += 1;
      }

      return { attempted: visits.length, synced, failed };
    } finally {
      this.retryRunning = false;
    }
  }

  buildEventPayload(visita: Visita, context: VisitCalendarContext = {}): GoogleCalendarEventPayload {
    const timeZone = this.configService.get<string>('GOOGLE_CALENDAR_DEFAULT_TIMEZONE') || 'America/Santiago';
    const startTime = normalizeTime(visita.horaProgramada);
    const end = addMinutes(visita.fechaProgramada, startTime, visita.duracionEstimadaMin ?? 60);
    const paciente = context.pacienteNombre ?? `Paciente ${visita.pacienteId}`;
    const profesional = context.profesionalNombre ?? null;
    const zona = context.zonaNombre ?? null;
    const direccion = context.direccion ?? null;

    return {
      summary: `Visita domiciliaria - ${paciente}`,
      description: [
        profesional ? `Profesional: ${profesional}` : null,
        zona ? `Zona: ${zona}` : null,
        direccion ? `Direccion: ${direccion}` : null,
        context.pacienteTelefono ? `Telefono paciente: ${context.pacienteTelefono}` : null,
        `Estado: ${visita.estado}`,
        `Prioridad: ${visita.prioridad}`,
        `ID visita: ${visita.id}`,
      ].filter(Boolean).join('\n'),
      location: direccion ?? undefined,
      start: { dateTime: `${visita.fechaProgramada}T${startTime}`, timeZone },
      end: { dateTime: `${end.date}T${end.time}`, timeZone },
    };
  }

  private async syncVisit(visita: Visita, action: SyncAction): Promise<Visita> {
    const connection = await this.findActiveConnection(visita.profesionalSaludId);
    if (!connection) return visita;

    const payload = action === 'DELETE' ? null : this.buildEventPayload(visita, await this.getVisitContext(visita));

    try {
      const accessToken = await this.getFreshAccessToken(connection);
      let response: { id?: string; etag?: string; htmlLink?: string } | undefined;

      if (action === 'CREATE' && payload) {
        response = await this.googleClient.createEvent(connection.calendarId, accessToken, payload);
        visita.googleCalendarEventId = response.id ?? null;
      } else if (action === 'UPDATE' && visita.googleCalendarEventId && payload) {
        response = await this.googleClient.updateEvent(connection.calendarId, visita.googleCalendarEventId, accessToken, payload);
      } else if (action === 'DELETE' && visita.googleCalendarEventId) {
        await this.googleClient.deleteEvent(connection.calendarId, visita.googleCalendarEventId, accessToken);
      }

      visita.googleCalendarConnectionId = connection.id;
      visita.googleCalendarId = connection.calendarId;
      visita.googleCalendarEventEtag = response?.etag ?? visita.googleCalendarEventEtag ?? null;
      visita.googleCalendarHtmlLink = response?.htmlLink ?? visita.googleCalendarHtmlLink ?? null;
      visita.googleCalendarSyncStatus = action === 'DELETE' ? 'DELETED' : 'SYNCED';
      visita.googleCalendarLastSyncAt = new Date();
      visita.googleCalendarLastError = null;
      visita.googleCalendarSyncAttempts = (visita.googleCalendarSyncAttempts ?? 0) + 1;
      const saved = await this.visitasRepo.save(visita);
      connection.lastSyncAt = visita.googleCalendarLastSyncAt;
      connection.lastSyncError = null;
      await this.connectionsRepo.save(connection);

      await this.log(visita, connection, action, 'SUCCESS', payload ?? undefined, response);
      return saved;
    } catch (error) {
      visita.googleCalendarSyncStatus = 'FAILED';
      visita.googleCalendarLastError = error instanceof Error ? error.message : 'Error desconocido sincronizando Google Calendar';
      visita.googleCalendarSyncAttempts = (visita.googleCalendarSyncAttempts ?? 0) + 1;
      const saved = await this.visitasRepo.save(visita);
      connection.lastSyncError = visita.googleCalendarLastError;
      await this.connectionsRepo.save(connection);

      await this.log(visita, connection, action, 'FAILED', payload ?? undefined, undefined, visita.googleCalendarLastError);
      return saved;
    }
  }

  private async deleteExistingEvent(visita: Visita): Promise<void> {
    const connection = visita.googleCalendarConnectionId
      ? await this.connectionsRepo.findOne({ where: { id: visita.googleCalendarConnectionId, deletedAt: IsNull() } })
      : null;

    if (!connection || !visita.googleCalendarEventId) return;

    try {
      const accessToken = await this.getFreshAccessToken(connection);
      await this.googleClient.deleteEvent(connection.calendarId, visita.googleCalendarEventId, accessToken);
      await this.log(visita, connection, 'DELETE', 'SUCCESS');
    } catch (error) {
      await this.log(visita, connection, 'DELETE', 'FAILED', undefined, undefined, error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  private async findActiveConnection(profesionalSaludId: string): Promise<ProfesionalGoogleCalendarConnection | null> {
    return this.connectionsRepo.findOne({
      where: { profesionalSaludId, syncEnabled: true, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  private async getVisitContext(visita: Visita): Promise<VisitCalendarContext> {
    const row = await this.visitasRepo.manager
      .createQueryBuilder()
      .select([
        `CONCAT_WS(' ', paciente.nombres, paciente.apellidos) AS "pacienteNombre"`,
        'paciente.telefono AS "pacienteTelefono"',
        `NULLIF(CONCAT_WS(', ',
          NULLIF(CONCAT_WS(' ', direccion.calle, direccion.numero), ''),
          direccion.departamento,
          direccion.comuna,
          direccion.region
        ), '') AS "direccionDetallada"`,
        'paciente.direccion AS "direccionPaciente"',
        'zona.nombre AS "zonaNombre"',
        `CONCAT_WS(' ', usuarioProfesional.nombres, usuarioProfesional.apellidos) AS "profesionalNombre"`,
      ])
      .from('visitas', 'visita')
      .leftJoin('pacientes', 'paciente', 'paciente.id = visita.paciente_id')
      .leftJoin('direcciones_paciente', 'direccion', 'direccion.id = visita.direccion_paciente_id AND direccion.deleted_at IS NULL')
      .leftJoin('zonas', 'zona', 'zona.id = visita.zona_id')
      .leftJoin('profesionales_salud', 'profesional', 'profesional.id = visita.profesional_salud_id')
      .leftJoin('usuarios', 'usuarioProfesional', 'usuarioProfesional.id = profesional.usuario_id')
      .where('visita.id = :id', { id: visita.id })
      .getRawOne<{
        pacienteNombre?: string | null;
        pacienteTelefono?: string | null;
        direccionDetallada?: string | null;
        direccionPaciente?: string | null;
        zonaNombre?: string | null;
        profesionalNombre?: string | null;
      }>();

    return {
      pacienteNombre: row?.pacienteNombre,
      pacienteTelefono: row?.pacienteTelefono,
      direccion: row?.direccionDetallada ?? row?.direccionPaciente ?? null,
      zonaNombre: row?.zonaNombre,
      profesionalNombre: row?.profesionalNombre,
    };
  }

  private async getFreshAccessToken(connection: ProfesionalGoogleCalendarConnection): Promise<string> {
    const bundle = this.decryptTokenBundle(connection);

    if (!connection.expiresAt || connection.expiresAt.getTime() > Date.now() + 60_000) {
      return bundle.accessToken;
    }

    if (!bundle.refreshToken) return bundle.accessToken;

    const refreshed = await this.googleClient.refreshToken(bundle.refreshToken);
    await this.persistTokenRefresh(connection, refreshed, bundle.refreshToken);

    return refreshed.access_token;
  }

  private async persistTokenRefresh(connection: ProfesionalGoogleCalendarConnection, token: GoogleTokenResponse, existingRefreshToken?: string): Promise<void> {
    const encrypted = this.tokenEncryption.encrypt(JSON.stringify({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? existingRefreshToken ?? null,
    }));
    connection.accessTokenCiphertext = encrypted.ciphertext;
    connection.refreshTokenCiphertext = null;
    connection.tokenEncryptionAlg = encrypted.alg;
    connection.tokenEncryptionIv = encrypted.iv;
    connection.tokenEncryptionTag = encrypted.tag;
    connection.tokenEncryptionKeyId = encrypted.keyId;
    connection.expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : connection.expiresAt;
    connection.lastSyncError = null;
    await this.connectionsRepo.save(connection);
  }

  private decryptTokenBundle(connection: ProfesionalGoogleCalendarConnection): { accessToken: string; refreshToken?: string | null } {
    const plaintext = this.tokenEncryption.decrypt(
      connection.accessTokenCiphertext,
      connection.tokenEncryptionIv,
      connection.tokenEncryptionTag,
    );

    try {
      const parsed = JSON.parse(plaintext) as { accessToken?: string; refreshToken?: string | null };
      if (parsed.accessToken) return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken ?? null };
    } catch {
      return { accessToken: plaintext, refreshToken: null };
    }

    return { accessToken: plaintext, refreshToken: null };
  }

  private log(
    visita: Visita,
    connection: ProfesionalGoogleCalendarConnection,
    action: SyncAction,
    status: string,
    requestPayload?: Record<string, unknown>,
    responsePayload?: Record<string, unknown>,
    errorMessage?: string,
  ) {
    return this.logsRepo.save(this.logsRepo.create({
      visitaId: visita.id,
      connectionId: connection.id,
      action,
      status,
      requestPayload: requestPayload ?? null,
      responsePayload: responsePayload ?? null,
      errorMessage: errorMessage ?? null,
    }));
  }
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [hours, mins, seconds] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hours, mins, seconds ?? 0));
  start.setUTCMinutes(start.getUTCMinutes() + minutes);
  return {
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 19),
  };
}
